import type { NormalizedJob } from "@/lib/types";
import { fetchWithTimeout, stripHtml, toIso } from "./shared";

// RemoteOK API: https://remoteok.com/api
// Returns a JSON array whose FIRST element is a legal/notice object (no `id`),
// followed by job objects: { id, slug, company, position, tags, description,
//   location, salary_min, salary_max, url, date, epoch }
interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  date?: string;
  epoch?: number;
}

function formatSalary(min?: number, max?: number): string | null {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min) return `From $${min.toLocaleString()}`;
  if (max) return `Up to $${max.toLocaleString()}`;
  return null;
}

export async function fetchRemoteOk(): Promise<NormalizedJob[]> {
  const res = await fetchWithTimeout("https://remoteok.com/api");
  if (!res.ok) throw new Error(`RemoteOK responded ${res.status}`);

  const data = (await res.json()) as RemoteOkJob[];
  if (!Array.isArray(data)) return [];

  return data
    // Drop the leading notice object and anything without an id/position.
    .filter((j) => j && j.id != null && j.position)
    .map((j) => ({
      source: "remoteok" as const,
      external_id: String(j.id),
      title: (j.position ?? "").trim() || "Untitled role",
      company: j.company?.trim() || null,
      description: stripHtml(j.description),
      tags: Array.isArray(j.tags) ? j.tags.slice(0, 20) : [],
      salary: formatSalary(j.salary_min, j.salary_max),
      location: j.location?.trim() || "Remote",
      url: j.url || (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : null),
      posted_at: toIso(j.epoch ?? j.date),
    }));
}
