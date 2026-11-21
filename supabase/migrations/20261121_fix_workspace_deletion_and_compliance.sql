-- ==============================================================================
-- SPRINTOS / PAPER5 - WORKSPACE DELETION & LAST-OWNER COMPLIANCE FIX
-- Generated: 2026-11-21
-- Purpose:
--   1. Allow complete workspace purge without tripping "Compliance Error: Cannot
--      remove or demote the last owner of a workspace".
--   2. Invalidate all pending invites and invite links immediately when workspace is deleted.
--   3. Completely eradicate all workspace data (members, tasks, sprints, meetings, logs).
-- ==============================================================================

-- 1. FIX TRIGGER: Check if parent workspace is being deleted before throwing compliance error
create or replace function public.check_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If the parent workspace does not exist or has already been deleted, skip compliance check
  if not exists (select 1 from public.workspaces where id = old.workspace_id) then
    return old;
  end if;

  -- Deletion check: cannot delete the last owner of an ACTIVE workspace
  if (tg_op = 'DELETE' and old.role = 'owner') then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id
        and role = 'owner'
        and user_id != old.user_id
    ) then
      -- If the workspace itself is being deleted, allow it
      -- Otherwise, raise compliance error
      if exists (select 1 from public.workspaces where id = old.workspace_id) then
        raise exception 'Compliance Error: Cannot remove or demote the last owner of a workspace.';
      end if;
    end if;
  end if;

  -- Demotion check: cannot demote the last owner of an ACTIVE workspace
  if (tg_op = 'UPDATE' and old.role = 'owner' and new.role != 'owner') then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = old.workspace_id
        and role = 'owner'
        and user_id != old.user_id
    ) then
      raise exception 'Compliance Error: Cannot remove or demote the last owner of a workspace.';
    end if;
  end if;

  return old;
end;
$$;

-- 2. DEDICATED ATOMIC WORKSPACE PURGE RPC (EXECUTED WITH ELEVATED PRIVILEGES)
create or replace function public.delete_workspace_completely(target_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_uid uuid;
  ws_creator uuid;
  is_admin boolean;
begin
  caller_uid := auth.uid();

  -- Verify caller is authenticated (or called via service role where auth.uid() is null)
  if caller_uid is not null then
    select created_by into ws_creator from public.workspaces where id = target_workspace_id;
    
    select exists (
      select 1 from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = caller_uid
        and role in ('owner', 'admin')
    ) into is_admin;

    if ws_creator != caller_uid and not coalesce(is_admin, false) then
      raise exception 'Access denied: Only workspace owners and admins can permanently delete a workspace.';
    end if;
  end if;

  -- Step 1: Invalidate all pending invites immediately (invite links become dead)
  delete from public.invites where workspace_id = target_workspace_id;
  delete from public.workspace_invites where workspace_id = target_workspace_id;

  -- Step 2: Delete all operational data
  delete from public.deadlines where workspace_id = target_workspace_id;
  delete from public.sprints where workspace_id = target_workspace_id;
  delete from public.meetings where workspace_id = target_workspace_id;
  delete from public.audit_logs where workspace_id = target_workspace_id;
  delete from public.evidence where workspace_id = target_workspace_id;
  delete from public.extra_work where workspace_id = target_workspace_id;

  -- Step 3: Delete members (temporarily bypass trigger)
  alter table public.workspace_members disable trigger all;
  delete from public.workspace_members where workspace_id = target_workspace_id;
  alter table public.workspace_members enable trigger all;

  -- Step 4: Delete the workspace row
  delete from public.workspaces where id = target_workspace_id;

  return jsonb_build_object(
    'success', true,
    'workspace_id', target_workspace_id,
    'message', 'Workspace and all associated data permanently eradicated.'
  );
exception when others then
  alter table public.workspace_members enable trigger all;
  raise;
end;
$$;

-- Grant execution to authenticated users and service_role
grant execute on function public.delete_workspace_completely(uuid) to authenticated, service_role;
