"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardCard } from "@/lib/types";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
      disabled={!text}
      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary transition hover:text-ink-primary disabled:opacity-40"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function DetailPanel({
  card,
  onClose,
  onCardUpdated,
}: {
  card: BoardCard | null;
  onClose: () => void;
  onCardUpdated: (card: BoardCard) => void;
}) {
  const { job, match, application } = card ?? {};

  const [resume, setResume] = useState("");
  const [cover, setCover] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate local editor state whenever a different card opens.
  useEffect(() => {
    if (application) {
      setResume(application.tailored_resume ?? "");
      setCover(application.tailored_cover_letter ?? "");
      setNotes(application.notes ?? "");
      setError("");
      setSaveMsg("");
    }
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape.
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  if (!card || !application || !job) return null;

  async function patch(body: Record<string, unknown>) {
    setSaveMsg("Saving…");
    try {
      const res = await fetch(`/api/applications/${application!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaveMsg("✓ Saved");
      setTimeout(() => setSaveMsg(""), 1200);
      onCardUpdated({ ...card!, application: data.application });
    } catch (e) {
      setSaveMsg("");
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function autosave(body: Record<string, unknown>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => patch(body), 700);
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/applications/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application!.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResume(data.draft.resume_summary);
      setCover(data.draft.cover_letter);
      onCardUpdated({ ...card!, application: data.application });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  const hasDraft = Boolean(resume || cover);

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-ink-primary/30"
        onClick={onClose}
      />
      {/* Panel */}
      <aside className="scroll-slim absolute right-0 top-0 flex h-full w-full max-w-xl animate-slide-in flex-col overflow-y-auto bg-surface shadow-panel">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink-primary">
                {job.title}
              </h2>
              {match && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                  {match.match_score}% fit
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-secondary">
              {job.company ?? "Unknown company"}
              {job.location ? ` · ${job.location}` : ""}
            </p>
            {match?.match_reason && (
              <p className="mt-1 text-xs italic text-ink-secondary">
                “{match.match_reason}”
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-secondary hover:bg-background hover:text-ink-primary"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {job.salary && (
              <span className="rounded bg-accent/10 px-2 py-1 font-medium text-accent">
                {job.salary}
              </span>
            )}
            <span className="rounded bg-background px-2 py-1 font-medium capitalize text-ink-secondary">
              {job.source}
            </span>
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-primary/10 px-2 py-1 font-medium text-primary hover:bg-primary/20"
              >
                View original posting ↗
              </a>
            )}
          </div>

          {/* Draft generation */}
          <div className="rounded-card border border-border bg-background/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Tailored application
                </h3>
                <p className="text-xs text-ink-secondary">
                  {hasDraft
                    ? "Edit freely — changes autosave."
                    : "Generate a resume summary and cover letter for this role."}
                </p>
              </div>
              <button
                onClick={generate}
                disabled={generating}
                className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {generating
                  ? "Generating…"
                  : hasDraft
                  ? "Regenerate"
                  : "Generate draft"}
              </button>
            </div>

            {error && (
              <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            {hasDraft && (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-ink-primary">
                      Resume summary
                    </label>
                    <CopyButton text={resume} label="Copy" />
                  </div>
                  <textarea
                    rows={4}
                    className={fieldClass}
                    value={resume}
                    onChange={(e) => {
                      setResume(e.target.value);
                      autosave({ tailored_resume: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-medium text-ink-primary">
                      Cover letter
                    </label>
                    <CopyButton text={cover} label="Copy" />
                  </div>
                  <textarea
                    rows={12}
                    className={fieldClass}
                    value={cover}
                    onChange={(e) => {
                      setCover(e.target.value);
                      autosave({ tailored_cover_letter: e.target.value });
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-primary">
              Notes
            </label>
            <textarea
              rows={3}
              className={fieldClass}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                autosave({ notes: e.target.value });
              }}
              placeholder="Recruiter name, referral, follow-up dates…"
            />
          </div>

          {/* Full description */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">
              Job description
            </h3>
            <div className="whitespace-pre-wrap rounded-card border border-border bg-background/60 p-4 text-sm leading-relaxed text-ink-secondary">
              {job.description || "No description provided."}
            </div>
          </div>

          <div className="pb-6 text-right text-xs text-ink-secondary">
            {saveMsg}
          </div>
        </div>
      </aside>
    </div>
  );
}
