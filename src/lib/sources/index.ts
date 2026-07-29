import type { JobSource, NormalizedJob } from "@/lib/types";
import { fetchRemotive } from "./remotive";
import { fetchArbeitnow } from "./arbeitnow";
import { fetchRemoteOk } from "./remoteok";
import type { SourceFetcher } from "./shared";

export const SOURCES: Record<JobSource, SourceFetcher> = {
  remotive: fetchRemotive,
  arbeitnow: fetchArbeitnow,
  remoteok: fetchRemoteOk,
};

export interface SourceResult {
  source: JobSource;
  ok: boolean;
  count: number;
  error?: string;
  jobs: NormalizedJob[];
}

// Fetch every source independently so one failure never blocks the others.
export async function fetchAllSources(): Promise<SourceResult[]> {
  const entries = Object.entries(SOURCES) as [JobSource, SourceFetcher][];

  return Promise.all(
    entries.map(async ([source, fetcher]): Promise<SourceResult> => {
      try {
        const jobs = await fetcher();
        return { source, ok: true, count: jobs.length, jobs };
      } catch (err) {
        console.error(`[ingest] source ${source} failed:`, err);
        return {
          source,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : String(err),
          jobs: [],
        };
      }
    })
  );
}
