import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import BrowseJobs from "@/components/BrowseJobs";
import type { BrowseJob, Profile } from "@/lib/types";

export const metadata = { title: "Browse Jobs · Roleflux" };
export const dynamic = "force-dynamic";

// Columns shown in the browse list — everything except the heavy `description`
// blob, which the cards never render. Keeping it out of the query lets us ship
// the whole catalog to the client cheaply.
const BROWSE_COLUMNS =
  "id, source, external_id, title, company, tags, salary, location, url, posted_at, created_at";

// PostgREST returns at most 1000 rows per request, so we page through the
// catalog in 1000-row chunks and stitch them together. This removes the old
// hard ceiling: every job the daily ingest has stored is browsable, not just
// the newest 1000. MAX_PAGES is only a runaway safety valve, set far above any
// realistic catalog size — not a product cap on how many jobs can appear.
const PAGE = 1000;
const MAX_PAGES = 50;

export default async function JobsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single<Profile>();

  if (!profile) redirect("/profile");

  // Read the raw ingested jobs directly, independent of any match score, so
  // the user always has real listings to browse and apply to. Newest first,
  // paged past the 1000-row response limit until the catalog is exhausted.
  const jobs: BrowseJob[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data: chunk, error } = await supabase
      .from("jobs")
      .select(BROWSE_COLUMNS)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error || !chunk || chunk.length === 0) break;
    jobs.push(...(chunk as unknown as BrowseJob[]));
    if (chunk.length < PAGE) break; // last (partial) page reached
  }

  // Which of these jobs are already on the caller's board (RLS-scoped).
  const { data: applications } = await supabase
    .from("applications")
    .select("job_id")
    .eq("profile_id", profile.id);

  const savedJobIds = (applications ?? []).map((a) => a.job_id);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar active="jobs" email={user.email} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <BrowseJobs initialJobs={jobs} savedJobIds={savedJobIds} />
      </main>
    </div>
  );
}
