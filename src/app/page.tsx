import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const features = [
    {
      title: "Always-on job feed",
      body: "We pull fresh remote roles from Remotive, Arbeitnow and RemoteOK every few hours.",
    },
    {
      title: "AI fit scoring",
      body: "Every listing is scored 0–100 against your profile, so weak matches never reach your board.",
    },
    {
      title: "Tailored drafts on demand",
      body: "Generate a resume summary and cover letter for any role in one click.",
    },
    {
      title: "A board that tracks itself",
      body: "Drag a card from New Match to Applied to Interview — that's your whole tracker.",
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-semibold text-ink-primary">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
            R
          </span>
          Roleflux
        </div>
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-14 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-ink-primary sm:text-5xl">
          Stop scrolling job boards.
          <br />
          Let AI surface the right remote roles.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-secondary">
          Set up your profile once. Roleflux continuously ingests remote
          listings, scores them against you, and drafts tailored applications on
          demand — all on a calm Kanban board.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            Get started free
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-card border border-border bg-surface p-6 shadow-card"
          >
            <h3 className="font-semibold text-ink-primary">{f.title}</h3>
            <p className="mt-2 text-sm text-ink-secondary">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
