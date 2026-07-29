"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCard } from "@/lib/types";

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
      {score}% fit
    </span>
  );
}

export default function JobCard({
  card,
  muted = false,
  onOpen,
}: {
  card: BoardCard;
  muted?: boolean;
  onOpen: (card: BoardCard) => void;
}) {
  const { job, match, application } = card;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: application.id, data: { card } });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const tags = [job.location, ...(job.tags ?? []).slice(0, 2)].filter(
    Boolean
  ) as string[];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      className={`group cursor-grab touch-none rounded-card border border-border bg-surface p-3.5 shadow-card transition active:cursor-grabbing ${
        muted ? "opacity-75 hover:opacity-100" : "hover:shadow-md"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4
          className={`line-clamp-2 text-sm font-semibold ${
            muted ? "text-ink-secondary" : "text-ink-primary"
          }`}
        >
          {job.title}
        </h4>
        {match && <ScoreBadge score={match.match_score} />}
      </div>

      <p className="mb-2 text-xs font-medium text-ink-secondary">
        {job.company ?? "Unknown company"}
      </p>

      {job.salary && (
        <p className="mb-2 text-xs text-accent">{job.salary}</p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
