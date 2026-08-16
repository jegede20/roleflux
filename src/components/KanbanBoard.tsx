"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import KanbanColumn from "@/components/KanbanColumn";
import JobCard from "@/components/JobCard";
import DetailPanel from "@/components/DetailPanel";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
  type BoardCard,
} from "@/lib/types";

export default function KanbanBoard({
  initialCards,
  profileReady,
}: {
  initialCards: BoardCard[];
  profileReady: boolean;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<BoardCard[]>(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  );

  const byStatus = useMemo(() => {
    const map: Record<ApplicationStatus, BoardCard[]> = {
      new_match: [],
      drafted: [],
      applied: [],
      interview: [],
      rejected: [],
    };
    for (const c of cards) map[c.application.status].push(c);
    // Newest / strongest first inside each column.
    for (const s of APPLICATION_STATUSES) {
      map[s].sort(
        (a, b) => (b.match?.match_score ?? 0) - (a.match?.match_score ?? 0)
      );
    }
    return map;
  }, [cards]);

  const activeCard = cards.find((c) => c.application.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const applicationId = String(active.id);
    const newStatus = String(over.id) as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(newStatus)) return;

    const current = cards.find((c) => c.application.id === applicationId);
    if (!current || current.application.status === newStatus) return;

    const prevStatus = current.application.status;

    // Optimistic update.
    setCards((prev) =>
      prev.map((c) =>
        c.application.id === applicationId
          ? { ...c, application: { ...c.application, status: newStatus } }
          : c
      )
    );

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    // Roll back on failure.
    if (!res.ok) {
      setCards((prev) =>
        prev.map((c) =>
          c.application.id === applicationId
            ? { ...c, application: { ...c.application, status: prevStatus } }
            : c
        )
      );
    }
  }

  async function scan() {
    setScanning(true);
    setScanMsg("");
    try {
      const res = await fetch("/api/match", { method: "POST" });
      // Parse defensively: a timed-out / errored function can return a non-JSON
      // body, and calling res.json() on that throws. We'd rather show a clear
      // message than a generic failure.
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setScanMsg(data?.error ?? "Scan failed. Please try again.");
        return;
      }

      const base =
        data.newMatches > 0
          ? `Found ${data.newMatches} new match${
              data.newMatches === 1 ? "" : "es"
            }.`
          : "No new strong matches this round.";
      // Each scan scores a limited batch, so tell the user when there's more
      // of their pool left to check.
      setScanMsg(
        data.remaining > 0
          ? `${base} ${data.remaining} more candidate${
              data.remaining === 1 ? "" : "s"
            } — scan again to check them.`
          : base
      );

      // The endpoint returns the caller's full, authoritative board. Update
      // state directly so new matches appear instantly — no page reload needed.
      if (Array.isArray(data.cards)) {
        setCards(data.cards as BoardCard[]);
      } else {
        // Fallback for any older response without cards.
        router.refresh();
      }
    } catch {
      setScanMsg("Scan failed. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  function handleCardUpdated(updated: BoardCard) {
    setCards((prev) =>
      prev.map((c) =>
        c.application.id === updated.application.id ? updated : c
      )
    );
    setSelected(updated);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-primary">Your board</h1>
          <p className="text-sm text-ink-secondary">
            Drag a card between columns to update its status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {scanMsg && (
            <span className="text-xs text-ink-secondary">{scanMsg}</span>
          )}
          <button
            onClick={scan}
            disabled={scanning || !profileReady}
            title={
              profileReady
                ? "Score fresh jobs against your profile"
                : "Complete your profile first"
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {scanning ? "Scanning…" : "Scan for jobs"}
          </button>
        </div>
      </div>

      {!profileReady && (
        <div className="mb-4 rounded-card border border-border bg-primary/5 px-4 py-3 text-sm text-ink-secondary">
          Add your target roles or skills on the{" "}
          <a href="/profile" className="font-semibold text-primary underline">
            profile page
          </a>{" "}
          so Roleflux can start matching jobs for you.
        </div>
      )}

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="scroll-slim flex flex-1 gap-4 overflow-x-auto pb-4">
          {APPLICATION_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              label={STATUS_LABELS[status]}
              cards={byStatus[status]}
              scanning={scanning}
              onOpen={setSelected}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-72 rotate-2">
              <JobCard card={activeCard} onOpen={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DetailPanel
        card={selected}
        onClose={() => setSelected(null)}
        onCardUpdated={handleCardUpdated}
      />
    </div>
  );
}
