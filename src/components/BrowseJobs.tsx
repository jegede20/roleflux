"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Job, JobSource } from "@/lib/types";

const SOURCE_LABELS: Record<JobSource, string> = {
  remotive: "Remotive",
  arbeitnow: "Arbeitnow",
  remoteok: "RemoteOK",
};

type Props = {
  initialJobs: Job[];
  savedJobIds: string[];
};

// Per-job fit result from /api/match/single.
type Fit = { score: number; reason: string | null; strong: boolean };

export default function BrowseJobs({ initialJobs, savedJobIds }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | JobSource>("all");
  const [saved, setSaved] = useState<Set<string>>(new Set(savedJobIds));
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fits, setFits] = useState<Record<string, Fit>>({});
  const [checking, setChecking] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialJobs.filter((job) => {
      if (source !== "all" && job.source !== source) return false;
      if (!q) return true;
      const haystack = [
        job.title,
        job.company ?? "",
        job.location ?? "",
        job.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [initialJobs, query, source]);

  async function checkFit(job: Job) {
    setError(null);
    setChecking((prev) => new Set(prev).add(job.id));
    try {
      const res = await fetch("/api/match/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not check fit");
      }
      setFits((prev) => ({
        ...prev,
        [job.id]: {
          score: data.score,
          reason: data.reason ?? null,
          strong: Boolean(data.strong),
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check fit");
    } finally {
      setChecking((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  }

  async function saveToBoard(job: Job) {
    setError(null);
    setSaving((prev) => new Set(prev).add(job.id));
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save job");
      }
      setSaved((prev) => new Set(prev).add(job.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save job");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink-primary">Browse jobs</h1>
        <p className="text-sm text-ink-secondary">
          Real remote listings from Remotive, Arbeitnow, and RemoteOK. Save any
          to your board to draft and track an application.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, company, tags, location…"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-primary sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-ink-secondary">
            Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "all" | JobSource)}
            className="rounded-md border border-border bg-surface px-2 py-2 text-sm text-ink-primary outline-none transition focus:border-primary"
          >
            <option value="all">All</option>
            <option value="remotive">Remotive</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="remoteok">RemoteOK</option>
          </select>
        </div>
        <span className="text-xs text-ink-secondary sm:ml-auto">
          {filtered.length} job{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-8 text-center text-sm text-ink-secondary">
          No jobs match your search. Try a different keyword or source.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((job) => {
            const isSaved = saved.has(job.id);
            const isSaving = saving.has(job.id);
            const isChecking = checking.has(job.id);
            const fit = fits[job.id];
            return (
              <li
                key={job.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="font-medium leading-snug text-ink-primary">
                      {job.title}
                    </h2>
                    <p className="text-sm text-ink-secondary">
                      {job.company ?? "Unknown company"}
                      {job.location ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {SOURCE_LABELS[job.source]}
                  </span>
                </div>

                {job.salary && (
                  <p className="text-sm font-medium text-ink-primary">
                    {job.salary}
                  </p>
                )}

                {job.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-background px-1.5 py-0.5 text-[11px] text-ink-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {fit && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      fit.strong
                        ? "border-green-300 bg-green-50 text-green-800"
                        : "border-border bg-background text-ink-secondary"
                    }`}
                  >
                    <p className="font-medium">
                      {fit.strong ? "Strong match" : "Weaker match"} · {fit.score}%
                    </p>
                    {fit.reason && <p className="mt-0.5">{fit.reason}</p>}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:text-ink-primary"
                    >
                      View posting
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={isChecking}
                    onClick={() => checkFit(job)}
                    className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isChecking
                      ? "Checking…"
                      : fit
                      ? "Recheck fit"
                      : "Check my fit"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaved || isSaving}
                    onClick={() => saveToBoard(job)}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaved
                      ? "On your board"
                      : isSaving
                      ? "Saving…"
                      : "Save to board"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
