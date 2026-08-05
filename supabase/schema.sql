
-- 7. Invites Table
create table public.invites (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null,
  invited_by uuid references public.users(id) not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.invites enable row level security;
create policy "Users can view invites for their workspaces" on public.invites for select using (
  workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
);

