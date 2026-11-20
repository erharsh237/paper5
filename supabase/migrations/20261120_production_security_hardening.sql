-- ==============================================================================
-- SPRINTOS / PAPER5 PRODUCTION DATABASE SECURITY HARDENING MIGRATION
-- Generated: 2026-11-20
-- Purpose:
--   1. Enable Row-Level Security (RLS) across all application tables.
--   2. Implement strict multi-tenant boundary isolation.
--   3. Restrict data access so non-admin squad members see only their assigned
--      tasks and authorized resources, while workspace admins/owners retain
--      full administrative command.
--   4. Document automated daily backups and Point-In-Time Recovery (PITR).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. AUTOMATED DAILY BACKUPS & PITR CONFIGURATION
-- ------------------------------------------------------------------------------
-- In Supabase PostgreSQL, physical backups and WAL archiving are managed at the
-- project infrastructure layer:
--   - Pro / Team / Enterprise tiers automatically execute daily physical backups
--     retained for 7 to 30 days.
--   - Point-in-Time Recovery (PITR) continuously streams WAL logs, enabling
--     sub-second state restoration to any millisecond within the retention window.
--   - For automated offsite cold backups, schedule a pg_dump cron job via:
--       pg_dump -h db.<PROJECT-REF>.supabase.co -U postgres -d postgres -F c -f "sprintos_backup_$(date +%Y%m%d_%H%M%S).dump"
-- ------------------------------------------------------------------------------

-- Ensure UUID extensions exist
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. SECURITY HELPER FUNCTIONS (DEFINER FOR ACCURATE RBAC EVALUATION)
-- ------------------------------------------------------------------------------

-- Check if current authenticated user is an active member of workspace
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;

-- Check if current authenticated user is an admin or owner of workspace
create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.owner_id = auth.uid()
  ) or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id 
      and wm.user_id = auth.uid() 
      and wm.role in ('admin', 'owner')
  );
$$;

-- Check if current authenticated user is the direct owner of workspace
create or replace function public.is_workspace_owner(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws_id and w.owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. ENABLE ROW-LEVEL SECURITY ON ALL CORE TABLES
-- ------------------------------------------------------------------------------

alter table if exists public.workspaces enable row level security;
alter table if exists public.workspace_members enable row level security;
alter table if exists public.deadlines enable row level security;
alter table if exists public.sprints enable row level security;
alter table if exists public.meetings enable row level security;
alter table if exists public.extra_work enable row level security;
alter table if exists public.evidence enable row level security;
alter table if exists public.invites enable row level security;
alter table if exists public.workspace_invites enable row level security;
alter table if exists public.feedback enable row level security;
alter table if exists public.users enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.audit_logs enable row level security;

-- ------------------------------------------------------------------------------
-- 3. WORKSPACES TABLE POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces" on public.workspaces
for select using (
  owner_id = auth.uid() or public.is_workspace_member(id)
);

drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces" on public.workspaces
for insert with check (
  auth.uid() is not null
);

drop policy if exists "Admins and owners can update their workspace" on public.workspaces;
create policy "Admins and owners can update their workspace" on public.workspaces
for update using (
  public.is_workspace_admin(id)
) with check (
  public.is_workspace_admin(id)
);

drop policy if exists "Only direct workspace owner can delete workspace" on public.workspaces;
create policy "Only direct workspace owner can delete workspace" on public.workspaces
for delete using (
  owner_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 4. WORKSPACE_MEMBERS TABLE POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Members can view workspace member roster" on public.workspace_members;
create policy "Members can view workspace member roster" on public.workspace_members
for select using (
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Admins can add workspace members" on public.workspace_members;
create policy "Admins can add workspace members" on public.workspace_members
for insert with check (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Admins can update workspace member roles" on public.workspace_members;
create policy "Admins can update workspace member roles" on public.workspace_members
for update using (
  public.is_workspace_admin(workspace_id)
) with check (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Admins can delete members or members leave workspace" on public.workspace_members;
create policy "Admins can delete members or members leave workspace" on public.workspace_members
for delete using (
  user_id = auth.uid() or public.is_workspace_admin(workspace_id)
);

-- ------------------------------------------------------------------------------
-- 5. DEADLINES / TASKS TABLE POLICIES (MULTI-TENANT USER ISOLATION)
-- ------------------------------------------------------------------------------

drop policy if exists "Deadlines select policy" on public.deadlines;
create policy "Deadlines select policy" on public.deadlines
for select using (
  -- 1. Admins/owners see all tasks in their workspace
  public.is_workspace_admin(workspace_id)
  -- 2. Non-admin members see only tasks assigned to them, created by them, or unassigned backlog
  or (
    public.is_workspace_member(workspace_id)
    and (
      assignee_id = auth.uid()
      or created_by = auth.uid()
      or lower(assignee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or assignee_id is null
    )
  )
);

drop policy if exists "Workspace members can create tasks" on public.deadlines;
create policy "Workspace members can create tasks" on public.deadlines
for insert with check (
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Deadlines update policy" on public.deadlines;
create policy "Deadlines update policy" on public.deadlines
for update using (
  -- Admins can update any task; assignees/creators can update their assigned task
  public.is_workspace_admin(workspace_id)
  or (
    public.is_workspace_member(workspace_id)
    and (
      assignee_id = auth.uid()
      or created_by = auth.uid()
      or lower(assignee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or assignee_id is null
    )
  )
) with check (
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Admins or creators can delete tasks" on public.deadlines;
create policy "Admins or creators can delete tasks" on public.deadlines
for delete using (
  public.is_workspace_admin(workspace_id)
  or (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  )
);

-- ------------------------------------------------------------------------------
-- 6. SPRINTS TABLE POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Workspace members can view sprints" on public.sprints;
create policy "Workspace members can view sprints" on public.sprints
for select using (
  public.is_workspace_member(workspace_id)
);

drop policy if exists "Admins can manage sprints insert" on public.sprints;
create policy "Admins can manage sprints insert" on public.sprints
for insert with check (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Admins can manage sprints update" on public.sprints;
create policy "Admins can manage sprints update" on public.sprints
for update using (
  public.is_workspace_admin(workspace_id)
) with check (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Admins can manage sprints delete" on public.sprints;
create policy "Admins can manage sprints delete" on public.sprints
for delete using (
  public.is_workspace_admin(workspace_id)
);

-- ------------------------------------------------------------------------------
-- 7. INVITES TABLE POLICIES (PROTECTED OFF-GITHUB / OFF-CLIENT)
-- ------------------------------------------------------------------------------

drop policy if exists "Invites view policy" on public.invites;
create policy "Invites view policy" on public.invites
for select using (
  public.is_workspace_admin(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Admins can create invites" on public.invites;
create policy "Admins can create invites" on public.invites
for insert with check (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Admins can delete invites" on public.invites;
create policy "Admins can delete invites" on public.invites
for delete using (
  public.is_workspace_admin(workspace_id)
);

-- ------------------------------------------------------------------------------
-- 8. USERS & PROFILES POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile" on public.users
for select using (
  auth.uid() = id
);

drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users
for update using (
  auth.uid() = id
) with check (
  auth.uid() = id
);

drop policy if exists "Profiles select policy" on public.profiles;
create policy "Profiles select policy" on public.profiles
for select using (
  auth.uid() is not null
);

drop policy if exists "Profiles update policy" on public.profiles;
create policy "Profiles update policy" on public.profiles
for update using (
  auth.uid() = id
) with check (
  auth.uid() = id
);

-- ------------------------------------------------------------------------------
-- 9. AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs" on public.audit_logs
for select using (
  public.is_workspace_admin(workspace_id)
);

drop policy if exists "Members can insert audit logs" on public.audit_logs;
create policy "Members can insert audit logs" on public.audit_logs
for insert with check (
  public.is_workspace_member(workspace_id)
);

-- ------------------------------------------------------------------------------
-- 10. PUBLIC FEEDBACK & CONTACT TABLES POLICIES
-- ------------------------------------------------------------------------------

drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback" on public.feedback
for insert with check (true);

drop policy if exists "Feedback view restricted" on public.feedback;
create policy "Feedback view restricted" on public.feedback
for select using (
  user_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 11. SUPABASE STORAGE BUCKET POLICIES (PRIVATE ACCESS & OWNER RESTRICTIONS)
-- ------------------------------------------------------------------------------

-- Ensure storage buckets exist and are marked private
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('resumes', 'resumes', false, 10485760, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('attachments', 'attachments', false, 20971520, null)
on conflict (id) do update set 
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = coalesce(excluded.allowed_mime_types, storage.buckets.allowed_mime_types);

-- RLS: Authenticated users can upload to their own user directory
drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read avatars" on storage.objects;
create policy "Users can read avatars" on storage.objects
for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own resumes" on storage.objects;
create policy "Users can upload their own resumes" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'resumes' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read their own resumes" on storage.objects;
create policy "Users can read their own resumes" on storage.objects
for select to authenticated
using (
  bucket_id = 'resumes' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files" on storage.objects
for delete to authenticated
using (
  (storage.foldername(name))[1] = auth.uid()::text
);

