import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import KanbanBoard from "@/components/KanbanBoard";
import type { Application, BoardCard, Job, Match, Profile } from "@/lib/types";

export const metadata = { title: "Board · Roleflux" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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

  // Applications joined with their jobs (RLS scopes to this profile).
  const { data: applications } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("profile_id", profile.id)
    .order("updated_at", { ascending: false });

  // Match scores for this profile, mapped by job_id.
  const { data: matches } = await supabase
    .from("matches")
    .select("job_id, match_score, match_reason")
    .eq("profile_id", profile.id);

  const matchByJob = new Map<string, Pick<Match, "match_score" | "match_reason">>();
  for (const m of matches ?? []) {
    matchByJob.set(m.job_id, {
      match_score: m.match_score,
      match_reason: m.match_reason,
    });
  }

  const cards: BoardCard[] = (
    (applications ?? []) as unknown as (Application & { job: Job | null })[]
  )
    .filter((a) => a.job)
    .map((a) => {
      const { job, ...application } = a;
      return {
        application: application as Application,
        job: job as Job,
        match: matchByJob.get(a.job_id) ?? null,
      };
    });

  const profileReady =
    profile.target_roles.length > 0 || profile.skills.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar active="dashboard" email={user.email} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <KanbanBoard initialCards={cards} profileReady={profileReady} />
      </main>
    </div>
  );
}
