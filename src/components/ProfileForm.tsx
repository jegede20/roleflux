"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MultiSelectCombobox from "@/components/MultiSelectCombobox";
import { ROLES, SKILLS, EXPERIENCE_LEVELS } from "@/lib/taxonomy";
import type { ExperienceLevel, Profile } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const supabase = createClient();

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [roles, setRoles] = useState<string[]>(profile.target_roles ?? []);
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [summary, setSummary] = useState(profile.experience_summary ?? "");
  const [years, setYears] = useState<ExperienceLevel | "">(
    profile.years_experience ?? ""
  );
  const [minSalary, setMinSalary] = useState<string>(
    profile.min_salary != null ? String(profile.min_salary) : ""
  );
  const [timezone, setTimezone] = useState(profile.timezone_pref ?? "");
  const [resume, setResume] = useState(profile.resume_base ?? "");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist a partial update to the profile row (RLS scopes to this user).
  const save = useCallback(
    async (patch: Partial<Profile>) => {
      setSaveState("saving");
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", profile.user_id);
      if (error) {
        console.error("profile save failed:", error.message);
        setSaveState("error");
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      }
    },
    [supabase, profile.user_id]
  );

  // Debounced variant for the resume textarea (fires while typing pauses).
  const saveDebounced = useCallback(
    (patch: Partial<Profile>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(patch), 800);
    },
    [save]
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Extracting text…");

    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadMsg(data.error ?? "Upload failed.");
      } else {
        setResume(data.text);
        await save({ resume_base: data.text, resume_file_path: data.filePath });
        setUploadMsg(`Imported ${data.text.length.toLocaleString()} characters.`);
      }
    } catch {
      setUploadMsg("Upload failed. Try pasting instead.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const inputClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-8">
      {/* Save indicator */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">
          Changes autosave as you go.
        </p>
        <span
          className={`text-xs font-medium ${
            saveState === "error"
              ? "text-red-600"
              : saveState === "saved"
              ? "text-accent"
              : "text-ink-secondary"
          }`}
        >
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "✓ Saved"}
          {saveState === "error" && "Save failed — retry"}
        </span>
      </div>

      {/* Basics */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-ink-primary">Basics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink-primary">
              Full name
            </label>
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => save({ full_name: fullName })}
              placeholder="Ada Lovelace"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-primary">
              Years of experience
            </label>
            <select
              className={inputClass}
              value={years}
              onChange={(e) => {
                const v = e.target.value as ExperienceLevel | "";
                setYears(v);
                save({ years_experience: v || null });
              }}
            >
              <option value="">Select…</option>
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-primary">
              Minimum salary (USD/yr, optional)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              className={inputClass}
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              onBlur={() =>
                save({
                  min_salary: minSalary ? parseInt(minSalary, 10) : null,
                })
              }
              placeholder="e.g. 90000"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink-primary">
              Timezone preference
            </label>
            <input
              className={inputClass}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              onBlur={() => save({ timezone_pref: timezone })}
              placeholder="e.g. UTC±2, US-friendly, EMEA overlap"
            />
          </div>
        </div>
      </section>

      {/* Roles & skills */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-ink-primary">
          Target roles & skills
        </h2>
        <div className="space-y-5">
          <MultiSelectCombobox
            label="Target roles"
            options={ROLES}
            selected={roles}
            onChange={(next) => {
              setRoles(next);
              save({ target_roles: next });
            }}
            placeholder="Search roles…"
          />
          <MultiSelectCombobox
            label="Skills"
            options={SKILLS}
            selected={skills}
            onChange={(next) => {
              setSkills(next);
              save({ skills: next });
            }}
            placeholder="Search skills…"
          />
        </div>
      </section>

      {/* Experience summary */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-ink-primary">
          Experience summary
        </h2>
        <textarea
          rows={4}
          className={inputClass}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => save({ experience_summary: summary })}
          placeholder="A few sentences on your background, standout wins, and what you're looking for next."
        />
      </section>

      {/* Resume */}
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-primary">Resume</h2>
          <label className="cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-ink-primary hover:border-primary">
            {uploading ? "Uploading…" : "Upload PDF / DOCX"}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        </div>
        {uploadMsg && (
          <p className="mb-3 text-xs text-ink-secondary">{uploadMsg}</p>
        )}
        <textarea
          rows={10}
          className={`${inputClass} font-mono text-xs`}
          value={resume}
          onChange={(e) => {
            setResume(e.target.value);
            saveDebounced({ resume_base: e.target.value });
          }}
          onBlur={() => save({ resume_base: resume })}
          placeholder="Paste your resume text here, or upload a file above to extract it automatically."
        />
      </section>
    </div>
  );
}
