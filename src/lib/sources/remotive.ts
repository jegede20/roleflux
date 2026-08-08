import type { NormalizedJob } from "@/lib/types";
import { cleanText, fetchWithTimeout, stripHtml, toIso } from "./shared";

// Remotive API: https://remotive.com/api/remote-jobs
// Response: { jobs: [{ id, title, company_name, category, tags, job_type,
//   candidate_required_location, salary, url, description, publication_date }] }
interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  candidate_required_location?: string;
  salary?: string;
  url: string;
  description: string;
  publication_date: string;
}

export async function fetchRemotive(): Promise<NormalizedJob[]> {
  const res = await fetchWithTimeout(
    "https://remotive.com/api/remote-jobs?limit=300"
  );
  if (!res.ok) throw new Error(`Remotive responded ${res.status}`);

  const data = (await res.json()) as { jobs?: RemotiveJob[] };
  const jobs = data.jobs ?? [];

  return jobs.map((j) => ({
    source: "remotive" as const,
    external_id: String(j.id),
    title: cleanText(j.title) || "Untitled role",
    company: cleanText(j.company_name) || null,
    description: stripHtml(j.description),
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 20) : [],
    salary: cleanText(j.salary) || null,
    location: cleanText(j.candidate_required_location) || null,
    url: j.url || null,
    posted_at: toIso(j.publication_date),
  }));
}
