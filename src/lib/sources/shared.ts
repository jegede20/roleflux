import type { NormalizedJob } from "@/lib/types";

// Decode the HTML entities that show up in feed text (titles, companies, and
// descriptions all arrive HTML-encoded from most sources). Handles the common
// named entities plus decimal/hex numeric entities like &#38; / &#x26;.
export function decodeEntities(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

// Strip HTML tags to plain text (job descriptions arrive as HTML from most
// sources). Keeps things readable for the LLM and the detail panel.
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Clean a short single-line field (title, company, location): decode entities,
// strip any stray tags, and collapse whitespace.
export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeEntities(value.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
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
