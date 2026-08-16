import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  scoreJobForProfile,
  relevanceScore,
  MATCH_THRESHOLD,
} from "@/lib/matching";
import type { Application, BoardCard, Job, Match, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many unscored jobs to process per invocation. Keeps us inside the
// function time budget (each Groq call ~1-several s; we run them in waves).
const MAX_JOBS_PER_RUN = 24;
const CONCURRENCY = 6;

// Hard wall-clock budget for the scoring loop. We stop starting new waves once
// this is exceeded and return cleanly, so the platform never kills the function
// mid-response (which would send the client a non-JSON timeout page and surface
// as a spurious "Scan failed"). Kept comfortably under maxDuration.
const TIME_BUDGET_MS = 40_000;

// How wide a slice of the catalog to consider as scan candidates. The relevance
// pre-filter below is cheap and in-memory, so we pull a large recent window
// (up to PostgREST's 1000-row page cap) and let the profile's roles/skills
// decide what's worth spending LLM budget on — rather than only ever seeing the
// 200 newest listings.
const CANDIDATE_POOL = 1000;

// Run scoring for the signed-in user's profile against jobs not yet matched.
// Called from the dashboard ("Scan for jobs") and safe to call repeatedly.
export async function POST() {
  const started = Date.now();
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
    .limit(CANDIDATE_POOL);

  // Jobs not yet scored for this profile.
  const unscored = (recentJobs ?? []).filter(
    (j) => !matchedIds.has(j.id)
  ) as Job[];

  // Relevance pre-filter: only spend LLM budget on jobs whose title/tags/
  // description actually overlap the profile's roles/skills. This keeps
  // clearly-unrelated postings off the board and stops junk from clearing the
  // threshold on a lucky guess. Rank the survivors by overlap (then recency,
  // preserved from the query order) so the strongest candidates get scored
  // first within the per-run budget.
  const candidates = unscored
    .map((job) => ({ job, relevance: relevanceScore(profile, job) }))
    .filter((c) => c.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .map((c) => c.job);

  const toScore = candidates.slice(0, MAX_JOBS_PER_RUN);

  let scored = 0;
  let created = 0;
  let processed = 0;

  // Process in small concurrent waves, stopping if we run out of time budget.
  for (let i = 0; i < toScore.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) break;

    const wave = toScore.slice(i, i + CONCURRENCY);
    processed += wave.length;

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

  // Return the caller's full, authoritative board so the client can update
  // instantly without a page reload. Scoped to this profile (derived from the
  // authenticated user), so there's no cross-account leakage. Mirrors the
  // dashboard's server-side card assembly.
  const cards = await buildBoardCards(admin, profile.id);

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    scored,
    newMatches: created,
    remaining: Math.max(0, candidates.length - processed),
    cards,
  });
}

// Assemble the Kanban board cards for one profile: each application joined with
// its job, plus any match score. Identical shape to what the dashboard renders.
async function buildBoardCards(
  admin: ReturnType<typeof createServiceClient>,
  profileId: string
): Promise<BoardCard[]> {
  const { data: applications } = await admin
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });

  const { data: matches } = await admin
    .from("matches")
    .select("job_id, match_score, match_reason")
    .eq("profile_id", profileId);

  const matchByJob = new Map<string, Pick<Match, "match_score" | "match_reason">>();
  for (const m of matches ?? []) {
    matchByJob.set(m.job_id, {
      match_score: m.match_score,
      match_reason: m.match_reason,
    });
  }

  return ((applications ?? []) as unknown as (Application & { job: Job | null })[])
    .filter((a) => a.job)
    .map((a) => {
      const { job, ...application } = a;
      return {
        application: application as Application,
        job: job as Job,
        match: matchByJob.get(a.job_id) ?? null,
      };
    });
}
