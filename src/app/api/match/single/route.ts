import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { scoreJobForProfile, MATCH_THRESHOLD } from "@/lib/matching";
import type { Job, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/match/single
// Body: { job_id: string }. Scores ONE specific job against the caller's
// profile on demand — used by the "Check my fit" button on the Browse page.
// Unlike the bulk scan, this bypasses the relevance pre-filter: the user has
// explicitly asked about this job, so we always run the model. The result is
// cached in `matches` so a later bulk scan won't re-score it.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!jobId) {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

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
      { error: "Complete your profile (roles or skills) before checking fit." },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  // If we've already scored this pairing, return the cached result instead of
  // spending another model call.
  const { data: cached } = await admin
    .from("matches")
    .select("match_score, match_reason")
    .eq("profile_id", profile.id)
    .eq("job_id", jobId)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      ok: true,
      score: cached.match_score,
      reason: cached.match_reason,
      strong: cached.match_score >= MATCH_THRESHOLD,
      cached: true,
    });
  }

  const { data: job } = await admin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single<Job>();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const result = await scoreJobForProfile(profile, job);
  if (!result) {
    return NextResponse.json(
      { error: "Scoring failed, please try again." },
      { status: 502 }
    );
  }

  // Cache the score so the bulk scan skips it later.
  await admin.from("matches").upsert(
    {
      profile_id: profile.id,
      job_id: job.id,
      match_score: result.score,
      match_reason: result.reason,
    },
    { onConflict: "profile_id,job_id", ignoreDuplicates: true }
  );

  return NextResponse.json({
    ok: true,
    score: result.score,
    reason: result.reason,
    strong: result.score >= MATCH_THRESHOLD,
    cached: false,
  });
}
