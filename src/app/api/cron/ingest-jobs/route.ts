import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllSources } from "@/lib/sources";
import type { NormalizedJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 100;

// Vercel Cron hits this every 6 hours (see vercel.json). Also invokable
// manually with the same bearer token for testing / first-run seeding.
export async function GET(request: Request) {
  // ── Auth: verify the cron secret ──────────────────────────────────────
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results = await fetchAllSources();

  // Combine all successfully-fetched jobs, then de-dupe within this batch on
  // (source, external_id) before hitting the DB.
  const seen = new Set<string>();
  const allJobs: NormalizedJob[] = [];
  for (const r of results) {
    for (const job of r.jobs) {
      const key = `${job.source}:${job.external_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allJobs.push(job);
    }
  }

  // ── Batched upsert with dedupe on the unique (source, external_id) ─────
  let inserted = 0;
  const upsertErrors: string[] = [];

  for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
    const batch = allJobs.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("jobs")
      .upsert(batch, {
        onConflict: "source,external_id",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) {
      console.error("[ingest] batch upsert error:", error.message);
      upsertErrors.push(error.message);
    } else {
      inserted += count ?? 0;
    }
  }

  const summary = {
    ok: true,
    fetched: allJobs.length,
    inserted,
    sources: results.map((r) => ({
      source: r.source,
      ok: r.ok,
      count: r.count,
      error: r.error,
    })),
    upsertErrors: upsertErrors.length ? upsertErrors : undefined,
  };

  console.log("[ingest] summary:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
