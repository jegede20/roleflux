import type { NormalizedJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIso } from "./shared";

// Arbeitnow API: https://www.arbeitnow.com/api/job-board-api
// Response: { data: [{ slug, company_name, title, description, remote, url,
//   tags, job_types, location, created_at (unix seconds) }], links, meta }
interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const res = await fetchWithTimeout(
    "https://www.arbeitnow.com/api/job-board-api"
  );
  if (!res.ok) throw new Error(`Arbeitnow responded ${res.status}`);

  const data = (await res.json()) as { data?: ArbeitnowJob[] };
  const jobs = data.data ?? [];

  return jobs
    // Roleflux is remote-only; keep remote listings (or those without a flag).
    .filter((j) => j.remote !== false)
    .map((j) => ({
      source: "arbeitnow" as const,
      external_id: j.slug,
      title: j.title?.trim() || "Untitled role",
      company: j.company_name?.trim() || null,
      description: stripHtml(j.description),
      tags: [...(j.tags ?? []), ...(j.job_types ?? [])].slice(0, 20),
      salary: null, // Arbeitnow does not expose a structured salary field.
      location: j.location?.trim() || (j.remote ? "Remote" : null),
      url: j.url || null,
      posted_at: toIso(j.created_at),
    }));
}
