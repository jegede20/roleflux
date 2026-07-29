-- ============================================================================
-- Roleflux — initial schema
-- Postgres / Supabase
-- ============================================================================

-- Enums --------------------------------------------------------------------
create type job_source as enum ('remotive', 'arbeitnow', 'remoteok');
create type experience_level as enum ('junior', 'mid', 'senior');
create type application_status as enum ('new_match', 'drafted', 'applied', 'interview', 'rejected');

-- ============================================================================
-- profiles : one row per authenticated user
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  target_roles text[] not null default '{}',
  skills text[] not null default '{}',
  experience_summary text,
  years_experience experience_level,
  min_salary int,
  timezone_pref text,
  resume_base text,
  resume_file_path text, -- optional pointer to Supabase Storage object
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- jobs : normalized listings from all sources (shared across users)
-- ============================================================================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  source job_source not null,
  external_id text not null,
  title text not null,
  company text,
  description text,
  tags text[] not null default '{}',
  salary text,
  location text,
  url text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists jobs_posted_at_idx on public.jobs (posted_at desc);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

-- ============================================================================
-- matches : AI score of a job for a given profile
-- ============================================================================
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  match_score int not null check (match_score between 0 and 100),
  match_reason text,
  created_at timestamptz not null default now(),
  unique (profile_id, job_id)
);

create index if not exists matches_profile_idx on public.matches (profile_id, match_score desc);

-- ============================================================================
-- applications : user's tracked pipeline (the Kanban board)
-- ============================================================================
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status application_status not null default 'new_match',
  tailored_resume text,
  tailored_cover_letter text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, job_id)
);

create index if not exists applications_profile_status_idx
  on public.applications (profile_id, status);

-- ============================================================================
-- taxonomy tables : fixed vocabularies for profile intake
-- ============================================================================
create table if not exists public.taxonomy_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text
);

create table if not exists public.taxonomy_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text
);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Auto-create a profile row when a user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.jobs enable row level security;
alter table public.taxonomy_roles enable row level security;
alter table public.taxonomy_skills enable row level security;

-- profiles: a user can only see/edit their own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

-- jobs: readable by any authenticated user (shared catalog). Writes happen
-- only via the service-role key in cron ingestion, which bypasses RLS.
create policy "jobs_select_authenticated" on public.jobs
  for select using (auth.role() = 'authenticated');

-- matches: visible only for the caller's own profile
create policy "matches_select_own" on public.matches
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = matches.profile_id and p.user_id = auth.uid()
    )
  );

-- applications: full CRUD scoped to the caller's own profile
create policy "applications_select_own" on public.applications
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = applications.profile_id and p.user_id = auth.uid()
    )
  );
create policy "applications_insert_own" on public.applications
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = applications.profile_id and p.user_id = auth.uid()
    )
  );
create policy "applications_update_own" on public.applications
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = applications.profile_id and p.user_id = auth.uid()
    )
  );
create policy "applications_delete_own" on public.applications
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = applications.profile_id and p.user_id = auth.uid()
    )
  );

-- taxonomy: read-only reference data for all authenticated users
create policy "taxonomy_roles_select" on public.taxonomy_roles
  for select using (auth.role() = 'authenticated');
create policy "taxonomy_skills_select" on public.taxonomy_skills
  for select using (auth.role() = 'authenticated');
