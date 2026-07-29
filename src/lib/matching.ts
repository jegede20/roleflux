import { groq, GROQ_MODEL, parseJsonObject } from "@/lib/groq";
import type { Job, Profile } from "@/lib/types";

export const MATCH_THRESHOLD = 60;

interface ScoreResult {
  score: number;
  reason: string;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// Score a single job against a profile. Returns null on any model/parse error
// so the caller can skip this pairing without aborting the whole batch.
export async function scoreJobForProfile(
  profile: Profile,
  job: Job
): Promise<ScoreResult | null> {
  const system =
    "You are a precise job-matching engine. You compare a candidate profile " +
    "to a remote job posting and rate the fit from 0-100. Respond with STRICT " +
    'JSON only, no prose: {"score": <int 0-100>, "reason": "<one sentence, max 20 words>"}. ' +
    "Weigh role/skill overlap, seniority fit, and salary expectations. Be conservative.";

  const user = `CANDIDATE
Target roles: ${profile.target_roles.join(", ") || "n/a"}
Skills: ${profile.skills.join(", ") || "n/a"}
Seniority: ${profile.years_experience ?? "n/a"}
Minimum salary: ${profile.min_salary ? `$${profile.min_salary}` : "no minimum"}
Experience summary: ${truncate(profile.experience_summary, 800)}

JOB
Title: ${job.title}
Company: ${job.company ?? "n/a"}
Salary: ${job.salary ?? "not listed"}
Tags: ${job.tags.join(", ") || "n/a"}
Description: ${truncate(job.description, 2500)}`;

  try {
    const completion = await groq().chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject<ScoreResult>(raw);

    let score = Math.round(Number(parsed.score));
    if (!Number.isFinite(score)) return null;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reason: String(parsed.reason ?? "").slice(0, 200),
    };
  } catch (err) {
    console.error(`[match] scoring failed for job ${job.id}:`, err);
    return null;
  }
}

interface DraftResult {
  resume_summary: string;
  cover_letter: string;
}

// Generate a tailored resume summary + cover letter for one job on demand.
export async function generateDraft(
  profile: Profile,
  job: Job
): Promise<DraftResult> {
  const system =
    "You are an expert career writer. Given a candidate and a specific job, " +
    "produce a tailored resume summary and a cover letter. Respond with STRICT " +
    'JSON only, no prose: {"resume_summary": "...", "cover_letter": "..."}. ' +
    "The cover letter must be 250-300 words, professional and warm in tone, " +
    "with NO placeholders or brackets (never write things like [Company] or " +
    "[Your Name]). Use the real company and role names provided. The resume " +
    "summary is 2-3 sentences highlighting the most relevant strengths.";

  const user = `CANDIDATE
Name: ${profile.full_name ?? "the candidate"}
Skills: ${profile.skills.join(", ") || "n/a"}
Experience summary: ${truncate(profile.experience_summary, 1000)}
Base resume:
${truncate(profile.resume_base, 4000)}

TARGET JOB
Title: ${job.title}
Company: ${job.company ?? "the company"}
Description:
${truncate(job.description, 3000)}`;

  const completion = await groq().chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObject<DraftResult>(raw);

  return {
    resume_summary: String(parsed.resume_summary ?? "").trim(),
    cover_letter: String(parsed.cover_letter ?? "").trim(),
  };
}
