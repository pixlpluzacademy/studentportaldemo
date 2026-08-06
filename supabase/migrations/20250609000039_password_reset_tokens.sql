-- Password reset tokens for Hostinger/Titan SMTP flow (not Supabase Auth email).

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens (user_id);

create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

alter table public.password_reset_tokens enable row level security;

-- No direct client access; only service-role / server APIs use this table.
drop policy if exists "password_reset_tokens_no_client_access" on public.password_reset_tokens;
create policy "password_reset_tokens_no_client_access"
  on public.password_reset_tokens
  for all
  to authenticated, anon
  using (false)
  with check (false);
