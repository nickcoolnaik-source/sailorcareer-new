-- SailorCareer Pro tools migration
alter table public.seafarer_profiles
  add column if not exists availability_status text not null default 'available_30',
  add column if not exists sea_service_records jsonb not null default '[]'::jsonb,
  add column if not exists certificate_expiries jsonb not null default '[]'::jsonb,
  add column if not exists service_interests text[] not null default '{}'::text[];


create table if not exists public.service_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 service_type text not null,
 full_name text not null,
 mobile text not null,
 rank text,
 message text not null,
 status text not null default 'new',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.service_requests enable row level security;
create policy service_requests_self on public.service_requests for select using (user_id=auth.uid() or public.is_admin());
create policy service_requests_insert on public.service_requests for insert with check (user_id=auth.uid());
