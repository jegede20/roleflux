import Groq from "groq-sdk";

// Groq deprecated llama-3.3-70b-versatile (shutdown 2026-08-16). Migrated to
// its recommended replacement, which supports the same JSON-mode API.
export const GROQ_MODEL = "openai/gpt-oss-120b";

let _client: Groq | null = null;

export function groq(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    _client = new Groq({ apiKey });
  }
  return _client;
}

// Robustly extract the first JSON object from an LLM response. Groq's JSON
// mode usually returns clean JSON, but this guards against stray prose or
// markdown fences just in case.
export function parseJsonObject<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "");
    const start = fenced.indexOf("{");
    const end = fenced.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(fenced.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse JSON from model response");
  }
}
