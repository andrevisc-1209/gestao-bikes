-- BikeCondo: schema, RLS policies, and RPCs
-- Run against a fresh Supabase project (SQL editor or `supabase db push`).

-- 1. Extensions -------------------------------------------------------------

create extension if not exists "pgcrypto";

-- 2. Enums --------------------------------------------------------------------

create type bike_status as enum ('pending', 'active', 'inactive');
create type incident_status as enum ('open', 'resolved');

-- 3. Tables -------------------------------------------------------------------

create table condo_settings (
  id uuid primary key default gen_random_uuid(),
  condo_name text not null default 'Condomínio',
  total_capacity int not null default 50,
  next_tag_number int not null default 1
);

-- Seed exactly one settings row. `on conflict` would never fire here (the
-- only unique key is a freshly generated uuid), so we guard with a
-- not-exists check instead to keep this a true singleton.
insert into condo_settings (condo_name)
select 'Residencial'
where not exists (select 1 from condo_settings);

create table bikes (
  id uuid primary key default gen_random_uuid(),
  tag_number text unique,
  unit_block text not null,
  owner_name text not null,
  owner_whatsapp text not null,
  brand_model text not null,
  color text not null,
  photo_url text,
  status bike_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id) on delete cascade,
  reason text not null,
  notes text,
  photo_url text,
  reporter_info text,
  status incident_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 4. Storage --------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bike-photos', 'bike-photos', true)
on conflict (id) do nothing;

-- 5. Row Level Security ----------------------------------------------------------

alter table condo_settings enable row level security;
alter table bikes enable row level security;
alter table incidents enable row level security;

-- condo_settings: authenticated (admin) only, no public access at all.
create policy "condo_settings_select_authenticated"
  on condo_settings for select
  to authenticated
  using (true);

create policy "condo_settings_update_authenticated"
  on condo_settings for update
  to authenticated
  using (true);

-- bikes: anyone can submit a pending registration; only admins can
-- read/update/delete (including approving and assigning tag numbers).
create policy "bikes_insert_pending"
  on bikes for insert
  to anon, authenticated
  with check (status = 'pending');

create policy "bikes_all_authenticated"
  on bikes for all
  to authenticated
  using (true);

-- incidents: anyone can report an incident; only admins manage them.
create policy "incidents_insert_anyone"
  on incidents for insert
  to anon, authenticated
  with check (true);

create policy "incidents_all_authenticated"
  on incidents for all
  to authenticated
  using (true);

-- storage.objects (bike-photos bucket): residents/reporters can upload,
-- everyone can read (bucket is public), only admins can update/delete.
create policy "bike_photos_insert_anyone"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'bike-photos');

create policy "bike_photos_select_anyone"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'bike-photos');

create policy "bike_photos_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'bike-photos');

create policy "bike_photos_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bike-photos');

-- 6. RPCs -------------------------------------------------------------------------

-- Public projection of an active bike by its visible tag number. Deliberately
-- excludes owner_name, unit_block, and owner_whatsapp — never widen this.
create function get_public_bike_by_tag(p_tag text)
returns table (
  id uuid,
  tag_number text,
  brand_model text,
  color text,
  photo_url text
)
language sql
security definer
set search_path = public
as $$
  select id, tag_number, brand_model, color, photo_url
  from bikes
  where tag_number = p_tag and status = 'active';
$$;

grant execute on function get_public_bike_by_tag(text) to anon, authenticated;

-- Atomically assigns the next tag number to a pending bike and activates it.
-- Avoids a race between concurrent approvals reading/writing next_tag_number.
create function approve_bike(p_bike_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
  v_tag text;
begin
  update condo_settings
  set next_tag_number = next_tag_number + 1
  where id = (select id from condo_settings limit 1)
  returning next_tag_number - 1 into v_next;

  v_tag := lpad(v_next::text, 3, '0');

  update bikes
  set tag_number = v_tag, status = 'active'
  where id = p_bike_id;

  return v_tag;
end;
$$;

-- Not granted to anon — only admins approve bikes.
grant execute on function approve_bike(uuid) to authenticated;
