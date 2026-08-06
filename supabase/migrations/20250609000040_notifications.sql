-- In-app notifications (header bell). Users see/manage only their own rows.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_id_read_at_idx
  on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- Inserts are server/service-role only (no client insert policy).
