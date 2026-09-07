-- SailorCareer production database schema for Supabase/Postgres
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('seafarer','employer','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.subscription_status as enum ('pending','active','suspended','expired','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text unique,
 full_name text,
 mobile text,
 role public.app_role not null default 'seafarer',
 is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.seafarer_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 dob date, nationality text, rank_id uuid, vessel_experience text[], total_sea_months integer default 0,
 rank_experience_months integer default 0, previous_companies text[], joining_availability date,
 preferred_vessels text[], preferred_sectors text[], preferred_locations text[], certificates text[],
 coc text, stcw text, medical text, passport_status text, cdc text, skills text[], resume_url text,
 photo_url text, professional_summary text, visibility text not null default 'employer_limited', updated_at timestamptz not null default now()
);
create table if not exists public.companies (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references public.profiles(id) on delete cascade,
 company_name text not null, company_type text, contact_person text, email text, mobile text, country text,
 office_address text, rpsl_number text, rpsl_status text, rpsl_details text, company_info text,
 recruitment_info text, verified boolean not null default false, verified_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.ranks (id uuid primary key default gen_random_uuid(), name text unique not null, group_name text, active boolean not null default true, sort_order int default 0);
create table if not exists public.vessel_types (id uuid primary key default gen_random_uuid(), name text unique not null, active boolean not null default true, sort_order int default 0);
create table if not exists public.sectors (id uuid primary key default gen_random_uuid(), name text unique not null, active boolean not null default true, sort_order int default 0);
create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 title text not null, rank_id uuid references public.ranks(id), vessel_type_id uuid references public.vessel_types(id), sector_id uuid references public.sectors(id),
 salary text, contract_duration text, joining_date date, experience_required text, required_certificates text[], location text,
 vessel_details text, job_description text, deadline date, status text not null default 'draft', approved boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id) on delete cascade,
 seafarer_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'Applied', note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(job_id,seafarer_id)
);
create table if not exists public.subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 plan text not null, status public.subscription_status not null default 'pending', amount numeric(12,2) not null,
 currency text not null default 'INR', provider text not null default 'cashfree', provider_order_id text unique,
 provider_event text, started_at timestamptz, renews_at timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.job_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 rank_ids uuid[], vessel_type_ids uuid[], sector_ids uuid[], locations text[], min_experience_months int,
 active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.employer_usage (
 employer_id uuid not null references public.profiles(id) on delete cascade, usage_date date not null default current_date,
 views int not null default 0, downloads int not null default 0, primary key(employer_id,usage_date), check(views between 0 and 75), check(downloads between 0 and 75)
);
create table if not exists public.employer_devices (
 id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.profiles(id) on delete cascade,
 device_hash text not null, user_agent text, last_seen_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(employer_id,device_hash)
);
create table if not exists public.saved_jobs (user_id uuid references public.profiles(id) on delete cascade, job_id uuid references public.jobs(id) on delete cascade, created_at timestamptz default now(), primary key(user_id,job_id));
create table if not exists public.payment_events (id uuid primary key default gen_random_uuid(), provider text, event_id text unique, order_id text, event_type text, payload jsonb, created_at timestamptz default now());

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and is_active=true) $$;
create or replace function public.is_employer() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='employer' and is_active=true) $$;
create or replace function public.is_seafarer() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='seafarer' and is_active=true) $$;

alter table public.profiles enable row level security;
alter table public.seafarer_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.ranks enable row level security;
alter table public.vessel_types enable row level security;
alter table public.sectors enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.job_alerts enable row level security;
alter table public.employer_usage enable row level security;
alter table public.employer_devices enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.payment_events enable row level security;

-- Profiles: user can manage only self; admins manage all.
create policy profiles_self on public.profiles for select using (id=auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert with check (id=auth.uid());
create policy profiles_update on public.profiles for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
-- Seafarer private profile: owner/admin. Employer sees only fields exposed through server-side candidate search policies/views.
create policy seafarer_self on public.seafarer_profiles for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy company_owner on public.companies for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy masters_public_read on public.ranks for select using (active=true or public.is_admin());
create policy masters_admin_write on public.ranks for all using (public.is_admin()) with check (public.is_admin());
create policy vessels_public_read on public.vessel_types for select using (active=true or public.is_admin());
create policy vessels_admin_write on public.vessel_types for all using (public.is_admin()) with check (public.is_admin());
create policy sectors_public_read on public.sectors for select using (active=true or public.is_admin());
create policy sectors_admin_write on public.sectors for all using (public.is_admin()) with check (public.is_admin());
create policy jobs_public_read on public.jobs for select using (status='published' and approved=true or company_id in(select id from companies where user_id=auth.uid()) or public.is_admin());
create policy jobs_employer_write on public.jobs for insert with check (public.is_employer() and company_id in(select id from companies where user_id=auth.uid()));
create policy jobs_owner_update on public.jobs for update using (company_id in(select id from companies where user_id=auth.uid()) or public.is_admin());
create policy apps_seafarer on public.applications for select using (seafarer_id=auth.uid() or public.is_admin() or job_id in(select j.id from jobs j join companies c on c.id=j.company_id where c.user_id=auth.uid()));
create policy apps_seafarer_insert on public.applications for insert with check (seafarer_id=auth.uid() and public.is_seafarer());
create policy apps_status_update on public.applications for update using (seafarer_id=auth.uid() or public.is_admin() or job_id in(select j.id from jobs j join companies c on c.id=j.company_id where c.user_id=auth.uid()));
create policy subs_self on public.subscriptions for select using (user_id=auth.uid() or public.is_admin());
create policy alerts_self on public.job_alerts for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());
create policy usage_self_admin on public.employer_usage for select using (employer_id=auth.uid() or public.is_admin());
create policy devices_self_admin on public.employer_devices for select using (employer_id=auth.uid() or public.is_admin());
create policy saved_self on public.saved_jobs for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy payment_admin on public.payment_events for select using (public.is_admin());

-- Trigger profile row after Supabase Auth signup. Role is always seafarer by default; employer/admin must be provisioned/approved server-side.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Seed editable master data.
insert into public.ranks(name,group_name,sort_order) values
('Master/Captain','Deck',1),('Chief Officer','Deck',2),('2nd Officer','Deck',3),('3rd Officer','Deck',4),('Deck Cadet','Deck',5),('Bosun','Deck',6),('AB','Deck',7),('OS','Deck',8),('Pumpman','Deck',9),
('Chief Engineer','Engine',10),('2nd Engineer','Engine',11),('3rd Engineer','Engine',12),('4th Engineer','Engine',13),('Engine Cadet','Engine',14),('Motorman/Oiler','Engine',15),('Fitter','Engine',16),
('ETO','Electrical',17),('ETR','Electrical',18),('Electrician','Electrical',19),('Reefer Engineer','Electrical',20),
('Chief Cook','Catering',21),('2nd Cook','Catering',22),('Steward','Catering',23),('Messman','Catering',24),('Chief Steward','Catering',25),
('DPO/DP Operator','Offshore',26),('Rig Manager','Offshore',27),('Toolpusher','Offshore',28),('Driller','Offshore',29),('Assistant Driller','Offshore',30),('Derrickman','Offshore',31),('Roustabout','Offshore',32),('Crane Operator','Offshore',33),('Barge Engineer','Offshore',34),
('Fishing Master','Fishing',35),('Skipper','Fishing',36),('Deckhand','Fishing',37),('Marine Surveyor','Other Maritime',38),('Marine Superintendent','Other Maritime',39),('Technical Superintendent','Other Maritime',40),('HSQE Officer','Other Maritime',41) on conflict(name) do nothing;
insert into public.vessel_types(name,sort_order) values ('Container Vessel',1),('Bulk Carrier',2),('Tanker',3),('Oil Tanker',4),('Product Tanker',5),('Chemical Tanker',6),('LNG Carrier',7),('LPG Carrier',8),('Ro-Ro/Car Carrier',9),('General Cargo',10),('Multi-Purpose Vessel',11),('Heavy Lift',12),('Offshore/DP',13),('PSV',14),('AHTS',15),('OSV',16),('Drillship',17),('Jack-up Rig',18),('Semi-submersible Rig',19),('FPSO/FSO',20),('Cruise/Passenger',21),('Ferry',22),('Yacht',23),('Fishing Vessel',24),('Research Vessel',25),('Dredger',26),('Tug/Workboat',27),('Cable Layer',28),('Wind Farm Support',29),('Government/Research',30) on conflict(name) do nothing;
insert into public.sectors(name,sort_order) values ('Merchant Shipping',1),('Offshore/Oil & Gas',2),('Cruise & Passenger',3),('Ferries',4),('Yachting',5),('Fishing',6),('Research',7),('Government/Public Sector',8),('Marine Services',9),('Ship Management',10) on conflict(name) do nothing;
