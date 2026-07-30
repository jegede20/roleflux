import Link from "next/link";

// Server component: top navigation for authenticated pages.
export default function NavBar({
  active,
  email,
}: {
  active: "dashboard" | "jobs" | "profile";
  email?: string | null;
}) {
  const linkBase =
    "rounded-md px-3 py-1.5 text-sm font-medium transition";
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold text-ink-primary"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              R
            </span>
            Roleflux
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className={`${linkBase} ${
                active === "dashboard"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Board
            </Link>
            <Link
              href="/jobs"
              className={`${linkBase} ${
                active === "jobs"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Browse
            </Link>
            <Link
              href="/profile"
              className={`${linkBase} ${
                active === "profile"
                  ? "bg-primary/10 text-primary"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Profile
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-xs text-ink-secondary sm:inline">
              {email}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:text-ink-primary"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
