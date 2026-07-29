// ============================================================================
// Shared domain types + the generated-ish Supabase Database type.
// ============================================================================

export type JobSource = "remotive" | "arbeitnow" | "remoteok";
export type ExperienceLevel = "junior" | "mid" | "senior";
export type ApplicationStatus =
  | "new_match"
  | "drafted"
  | "applied"
  | "interview"
  | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "new_match",
  "drafted",
  "applied",
  "interview",
  "rejected",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new_match: "New Matches",
  drafted: "Drafted",
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
};

// NOTE: These Row types are declared as `type` aliases (not `interface`s) on
// purpose. TypeScript infers an implicit index signature for object `type`
// aliases but NOT for interfaces (which stay open to declaration merging).
// The supabase-js `Database` generic requires each table's `Row` to satisfy
// `Record<string, unknown>` (via postgrest-js `GenericTable`); interfaces fail
// that constraint, which collapses the resolved schema to `never` and makes
// every query builder `never`-typed. Keep these as `type`.
export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  target_roles: string[];
  skills: string[];
  experience_summary: string | null;
  years_experience: ExperienceLevel | null;
  min_salary: number | null;
  timezone_pref: string | null;
  resume_base: string | null;
  resume_file_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  source: JobSource;
  external_id: string;
  title: string;
  company: string | null;
  description: string | null;
  tags: string[];
  salary: string | null;
  location: string | null;
  url: string | null;
  posted_at: string | null;
  created_at: string;
};

export type Match = {
  id: string;
  profile_id: string;
  job_id: string;
  match_score: number;
  match_reason: string | null;
  created_at: string;
};

export type Application = {
  id: string;
  profile_id: string;
  job_id: string;
  status: ApplicationStatus;
  tailored_resume: string | null;
  tailored_cover_letter: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxonomyItem = {
  id: string;
  name: string;
  category: string | null;
};

// A denormalized card as consumed by the Kanban board: one application joined
// with its job and (optionally) match metadata.
export type BoardCard = {
  application: Application;
  job: Job;
  match: Pick<Match, "match_score" | "match_reason"> | null;
};

// Shape used when normalizing an external listing before upsert.
export type NormalizedJob = Omit<Job, "id" | "created_at">;

// ---------------------------------------------------------------------------
// Minimal Database type for @supabase/supabase-js generics.
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { user_id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: NormalizedJob;
        Update: Partial<Job>;
        Relationships: [];
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, "id" | "created_at">;
        Update: Partial<Match>;
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: { profile_id: string; job_id: string } & Partial<Application>;
        Update: Partial<Application>;
        Relationships: [];
      };
      taxonomy_roles: {
        Row: TaxonomyItem;
        Insert: Omit<TaxonomyItem, "id">;
        Update: Partial<TaxonomyItem>;
        Relationships: [];
      };
      taxonomy_skills: {
        Row: TaxonomyItem;
        Insert: Omit<TaxonomyItem, "id">;
        Update: Partial<TaxonomyItem>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      job_source: JobSource;
      experience_level: ExperienceLevel;
      application_status: ApplicationStatus;
    };
  };
}
