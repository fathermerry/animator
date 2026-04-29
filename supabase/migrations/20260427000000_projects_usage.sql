create table if not exists public.projects (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  file_label text,
  is_sample boolean not null default false,
  slice jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.projects
  alter column user_id drop not null;

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc)
  where deleted_at is null;

create index if not exists projects_updated_idx
  on public.projects (updated_at desc)
  where deleted_at is null;

alter table public.projects enable row level security;

drop policy if exists "users can read own projects" on public.projects;
drop policy if exists "anyone can read projects" on public.projects;
create policy "anyone can read projects"
on public.projects for select
to anon, authenticated
using (true);

drop policy if exists "users can insert own projects" on public.projects;
drop policy if exists "anyone can insert projects" on public.projects;
create policy "anyone can insert projects"
on public.projects for insert
to anon, authenticated
with check (true);

drop policy if exists "users can update own projects" on public.projects;
drop policy if exists "anyone can update projects" on public.projects;
create policy "anyone can update projects"
on public.projects for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "users can delete own projects" on public.projects;
drop policy if exists "anyone can delete projects" on public.projects;
create policy "anyone can delete projects"
on public.projects for delete
to anon, authenticated
using (true);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  render_id text,
  provider text not null,
  model text not null,
  event_type text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  input_characters integer not null default 0,
  image_count integer not null default 0,
  audio_seconds numeric not null default 0,
  cost_amount numeric not null default 0,
  cost_currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events
  alter column user_id drop not null;

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

create index if not exists usage_events_project_created_idx
  on public.usage_events (project_id, created_at desc);

alter table public.usage_events enable row level security;

drop policy if exists "users can read own usage" on public.usage_events;
drop policy if exists "anyone can read usage" on public.usage_events;
create policy "anyone can read usage"
on public.usage_events for select
to anon, authenticated
using (true);

drop policy if exists "users can insert own usage" on public.usage_events;
drop policy if exists "anyone can insert usage" on public.usage_events;
create policy "anyone can insert usage"
on public.usage_events for insert
to anon, authenticated
with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects;
  end if;
exception
  when duplicate_object then null;
end $$;
