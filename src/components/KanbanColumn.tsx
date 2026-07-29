"use client";

import { useDroppable } from "@dnd-kit/core";
import JobCard from "@/components/JobCard";
import type { ApplicationStatus, BoardCard } from "@/lib/types";

const EMPTY_COPY: Record<ApplicationStatus, string> = {
  new_match: "Scanning for jobs…",
  drafted: "Generate a draft from a new match to move it here.",
  applied: "Cards you've applied to land here.",
  interview: "Fingers crossed — interviews show up here.",
  rejected: "Closed opportunities rest here. Onward.",
};

export default function KanbanColumn({
  status,
  label,
  cards,
  scanning,
  onOpen,
}: {
  status: ApplicationStatus;
  label: string;
  cards: BoardCard[];
  scanning: boolean;
  onOpen: (card: BoardCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isRejected = status === "rejected";

  return (
    <div className="flex w-full shrink-0 flex-col sm:w-72">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3
            className={`text-sm font-semibold ${
              isRejected ? "text-ink-secondary" : "text-ink-primary"
            }`}
          >
            {label}
          </h3>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-ink-secondary">
            {cards.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`scroll-slim flex min-h-[140px] flex-1 flex-col gap-2.5 rounded-card border p-2.5 transition sm:max-h-[calc(100vh-190px)] sm:overflow-y-auto ${
          isRejected
            ? "border-border/60 bg-slate-50"
            : "border-border bg-background/60"
        } ${isOver ? "ring-2 ring-primary/40" : ""}`}
      >
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-8 text-center text-xs text-ink-secondary">
            {status === "new_match" && scanning
              ? "Scanning for jobs…"
              : EMPTY_COPY[status]}
          </div>
        ) : (
          cards.map((card) => (
            <JobCard
              key={card.application.id}
              card={card}
              muted={isRejected}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
