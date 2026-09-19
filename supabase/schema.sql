-- ============================================================================
-- NOVA — Supabase schema + Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor (Dashboard -> SQL -> New query -> Run).
-- It creates the tables, security policies, and a trigger that mirrors new
-- auth users into a public "profiles" table so we can show names/emails.
--
-- Data model:
--   profiles          one row per auth user (name, email)
--   projects          owned by a user, has a status
--   project_members   join table (which users belong to which project)
--   tasks             belong to a project, optionally assigned to a member
--
-- Access model (enforced by RLS):
--   - A user can read a project if they are a member of it.
--   - Only the owner can update/delete a project or manage its members.
--   - Members can read/create/update/delete tasks in their projects.
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type project_status as enum ('active', 'on_hold', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles: public-facing user info, keyed to auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  email      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  status      project_status not null default 'active',
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  description text not null default '',
  status      task_status not null default 'todo',
  priority    task_priority not null default 'medium',
  due_date    date,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists members_user_idx on public.project_members (user_id);

-- ============================================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ----------------------------------------------------------------------------
-- Referencing project_members inside a project_members policy would recurse.
-- These run with definer rights, bypassing RLS for the membership check only.
-- ============================================================================

create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = pid and owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- New-user trigger: copy auth.users into public.profiles
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Add the owner as a member automatically when a project is created
-- ============================================================================

create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.add_owner_as_member();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;

-- ---------- profiles ----------
-- Any authenticated user can read profiles (needed to look up members by email
-- and to display names). Users may only insert/update their own row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- projects ----------
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (owner_id = auth.uid());

-- ---------- project_members ----------
-- A member can see the membership rows of projects they belong to.
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members
  for select to authenticated using (public.is_project_member(project_id));

-- Only the project owner can add members.
drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members
  for insert to authenticated with check (public.is_project_owner(project_id));

-- Only the owner can remove members (and never the owner themselves,
-- enforced in app logic + the check below).
drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated using (public.is_project_owner(project_id));

-- ---------- tasks ----------
-- Any project member can read and manage tasks in that project.
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated using (public.is_project_member(project_id));

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated with check (
    public.is_project_member(project_id) and created_by = auth.uid()
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_project_member(project_id));

-- ============================================================================
-- keep updated_at fresh
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
