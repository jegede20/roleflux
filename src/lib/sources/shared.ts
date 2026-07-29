import type { NormalizedJob } from "@/lib/types";

// Strip HTML tags to plain text (job descriptions arrive as HTML from most
// sources). Keeps things readable for the LLM and the detail panel.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  // Accept unix seconds (RemoteOK epoch), ISO strings, or Date-parseable text.
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Fetch with a hard timeout so a slow source can't blow the 10s function budget.
export async function fetchWithTimeout(
  url: string,
  ms = 8000,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "Roleflux/1.0 (+https://roleflux.app)",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export type SourceFetcher = () => Promise<NormalizedJob[]>;
