import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { scoreJobForProfile, MATCH_THRESHOLD } from "@/lib/matching";
import type { Job, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many unscored jobs to process per invocation. Keeps us inside the
// function time budget (each Groq call ~1s; we run them in small waves).
const MAX_JOBS_PER_RUN = 24;
const CONCURRENCY = 4;

// Run scoring for the signed-in user's profile against jobs not yet matched.
// Called from the dashboard ("Scan for jobs") and safe to call repeatedly.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // A profile needs at least roles or skills to score meaningfully.
  if (profile.target_roles.length === 0 && profile.skills.length === 0) {
    return NextResponse.json(
      { error: "Complete your profile (roles or skills) before scanning." },
      { status: 400 }
    );
  }

  // Use the service client for the heavy read/writes (bypass RLS on jobs and
  // to insert matches/applications for this profile).
  const admin = createServiceClient();

  // Find recent jobs that don't yet have a match for this profile.
  const { data: existing } = await admin
    .from("matches")
    .select("job_id")
    .eq("profile_id", profile.id);
  const matchedIds = new Set((existing ?? []).map((m) => m.job_id));

  const { data: recentJobs } = await admin
    .from("jobs")
    .select("*")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const candidates = (recentJobs ?? []).filter(
    (j) => !matchedIds.has(j.id)
  ) as Job[];
  const toScore = candidates.slice(0, MAX_JOBS_PER_RUN);

  let scored = 0;
  let created = 0;

  // Process in small concurrent waves.
  for (let i = 0; i < toScore.length; i += CONCURRENCY) {
    const wave = toScore.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      wave.map(async (job) => {
        const result = await scoreJobForProfile(profile, job);
        return { job, result };
      })
    );

    for (const { job, result } of results) {
      if (!result) continue;
      scored++;

      // Always record the match (so we don't re-score it), but only surface
      // strong matches on the board.
      await admin.from("matches").upsert(
        {
          profile_id: profile.id,
          job_id: job.id,
          match_score: result.score,
          match_reason: result.reason,
        },
        { onConflict: "profile_id,job_id", ignoreDuplicates: true }
      );

      if (result.score >= MATCH_THRESHOLD) {
        const { error } = await admin.from("applications").upsert(
          {
            profile_id: profile.id,
            job_id: job.id,
            status: "new_match",
          },
          { onConflict: "profile_id,job_id", ignoreDuplicates: true }
        );
        if (!error) created++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    scored,
    newMatches: created,
    remaining: Math.max(0, candidates.length - toScore.length),
  });
}
