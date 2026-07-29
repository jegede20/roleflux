"use client";

import { useMemo, useRef, useState } from "react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

// Searchable multi-select constrained to a fixed option list (the taxonomy).
// No free-text entry — users can only pick from `options`.
export default function MultiSelectCombobox({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search…",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selected.includes(o))
      .filter((o) => (q ? o.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [options, selected, query]);

  function add(value: string) {
    if (!selected.includes(value)) onChange([...selected, value]);
    setQuery("");
    setActiveIdx(0);
  }

  function remove(value: string) {
    onChange(selected.filter((s) => s !== value));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIdx]) add(filtered[activeIdx]);
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className="mb-1.5 block text-sm font-medium text-ink-primary">
        {label}
      </label>

      <div
        className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        onClick={() => setOpen(true)}
      >
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(s);
              }}
              className="rounded-full text-primary/70 hover:text-primary"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? "" : placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-ink-primary outline-none"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="scroll-slim absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-card">
          {filtered.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(o);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === activeIdx
                    ? "bg-primary/10 text-primary"
                    : "text-ink-primary hover:bg-background"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-secondary shadow-card">
          No matching options.
        </div>
      )}
    </div>
  );
}
