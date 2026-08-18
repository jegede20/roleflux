"use client";

import { useState } from "react";
import Link from "next/link";

type NavKey = "dashboard" | "jobs" | "profile";

const LINKS: { href: string; label: string; key: NavKey }[] = [
  { href: "/dashboard", label: "Board", key: "dashboard" },
  { href: "/jobs", label: "Browse", key: "jobs" },
  { href: "/profile", label: "Profile", key: "profile" },
];

// Top navigation for authenticated pages. Client component so the mobile
// hamburger menu can toggle — on small screens the links + sign out collapse
// behind the button instead of overflowing the header.
export default function NavBar({
  active,
  email,
}: {
  active: NavKey;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const linkBase = "rounded-md px-3 py-1.5 text-sm font-medium transition";

  function linkClass(key: NavKey) {
    return `${linkBase} ${
      active === key
        ? "bg-primary/10 text-primary"
        : "text-ink-secondary hover:text-ink-primary"
    }`;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold text-ink-primary"
            onClick={() => setOpen(false)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              R
            </span>
            Roleflux
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link key={l.key} href={l.href} className={linkClass(l.key)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop right side */}
        <div className="hidden items-center gap-3 sm:flex">
          {email && (
            <span className="text-xs text-ink-secondary">{email}</span>
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

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-md border border-border text-ink-primary transition hover:border-primary sm:hidden"
        >
          {open ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="border-t border-border bg-surface sm:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                onClick={() => setOpen(false)}
                className={linkClass(l.key)}
              >
                {l.label}
              </Link>
            ))}
            {email && (
              <span className="px-3 pt-2 text-xs text-ink-secondary">
                {email}
              </span>
            )}
            <form action="/auth/signout" method="post" className="pt-1">
              <button
                type="submit"
                className="w-full rounded-md border border-border px-3 py-1.5 text-left text-sm font-medium text-ink-secondary transition hover:text-ink-primary"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      )}
    </header>
  );
}
