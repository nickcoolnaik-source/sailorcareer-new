-- SailorCareer V12: private seafarer document vault
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('seafarer-documents','seafarer-documents',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.seafarer_documents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('resume','coc','stcw','medical','passport_cdc','other')),
 file_name text not null, mime_type text not null, size_bytes bigint not null, storage_path text not null unique,
 created_at timestamptz not null default now()
);
alter table public.seafarer_documents enable row level security;
drop policy if exists "seafarer_documents_owner_select" on public.seafarer_documents;
create policy "seafarer_documents_owner_select" on public.seafarer_documents for select using (auth.uid()=user_id);
drop policy if exists "seafarer_documents_owner_insert" on public.seafarer_documents;
create policy "seafarer_documents_owner_insert" on public.seafarer_documents for insert with check (auth.uid()=user_id);
create index if not exists seafarer_documents_user_idx on public.seafarer_documents(user_id,created_at desc);
