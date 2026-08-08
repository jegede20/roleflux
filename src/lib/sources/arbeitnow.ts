import type { NormalizedJob } from "@/lib/types";
import { cleanText, fetchWithTimeout, stripHtml, toIso } from "./shared";

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
  // Arbeitnow is Laravel-paginated (~100 jobs/page via ?page=N). Pull several
  // pages so the catalog isn't limited to the ~100 newest. Pages are fetched
  // sequentially and we stop early if a page comes back empty.
  const MAX_PAGES = 3;
  const raw: ArbeitnowJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetchWithTimeout(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`
    );
    if (!res.ok) {
      // A mid-pagination failure shouldn't discard the pages we already have.
      if (page === 1) throw new Error(`Arbeitnow responded ${res.status}`);
      break;
    }

    const data = (await res.json()) as { data?: ArbeitnowJob[] };
    const pageJobs = data.data ?? [];
    if (pageJobs.length === 0) break;
    raw.push(...pageJobs);
  }

  return raw
    // Roleflux is remote-only; keep remote listings (or those without a flag).
    .filter((j) => j.remote !== false)
    .map((j) => ({
      source: "arbeitnow" as const,
      external_id: j.slug,
      title: cleanText(j.title) || "Untitled role",
      company: cleanText(j.company_name) || null,
      description: stripHtml(j.description),
      tags: [...(j.tags ?? []), ...(j.job_types ?? [])].slice(0, 20),
      salary: null, // Arbeitnow does not expose a structured salary field.
      location: cleanText(j.location) || (j.remote ? "Remote" : null),
      url: j.url || null,
      posted_at: toIso(j.created_at),
    }));
}
