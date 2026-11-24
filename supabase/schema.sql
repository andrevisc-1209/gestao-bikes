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

-- Pool of pre-printed sticker tag numbers. Admins generate batches ahead of
-- time (generate_sticker_batch); approve_bike claims one atomically instead
-- of incrementing condo_settings.next_tag_number.
create table stickers (
  tag_number text primary key,
  status text not null default 'available' check (status in ('available', 'assigned')),
  bike_id uuid references bikes(id),
  created_at timestamptz not null default now()
);

-- Snapshot of a bike's registration fields taken immediately before each
-- edit via update_bike_registration. Written only by that SECURITY DEFINER
-- RPC — never insert/update/delete here directly.
create table bikes_history (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id),
  tag_number text,
  unit_block text not null,
  owner_name text not null,
  owner_whatsapp text not null,
  brand_model text not null,
  color text not null,
  photo_url text,
  status bike_status not null,
  created_at timestamptz not null,
  edited_at timestamptz not null default now(),
  edited_by uuid references auth.users(id)
);

-- 4. Storage --------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('bike-photos', 'bike-photos', true)
on conflict (id) do nothing;

-- 5. Row Level Security ----------------------------------------------------------

-- RLS policies alone are not enough: Postgres also requires the calling role
-- to hold the base table-level privilege, which tables created via raw SQL
-- (as opposed to the Studio's table editor) do not receive automatically.
-- Without these grants, every request fails with "permission denied for
-- table ..." even when the matching RLS policy would allow the row.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on bikes to authenticated;
grant insert on bikes to anon;
grant select, insert, update, delete on incidents to authenticated;
grant insert on incidents to anon;
grant select, update on condo_settings to authenticated;
grant select on stickers to authenticated;
-- no insert/update grant to anon or authenticated directly — only the
-- SECURITY DEFINER RPCs below ever write to this table.
grant select on bikes_history to authenticated;
-- No insert/update/delete grant to anyone — only update_bike_registration
-- (security definer) writes here.

alter table condo_settings enable row level security;
alter table bikes enable row level security;
alter table incidents enable row level security;
alter table stickers enable row level security;
alter table bikes_history enable row level security;

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
  with check (status = 'pending' and tag_number is null);

create policy "bikes_all_authenticated"
  on bikes for all
  to authenticated
  using (true);

-- incidents: anyone can report an incident; only admins manage them.
create policy "incidents_insert_anyone"
  on incidents for insert
  to anon, authenticated
  with check (status = 'open' and resolved_at is null);

create policy "incidents_all_authenticated"
  on incidents for all
  to authenticated
  using (true);

-- stickers: admins only read directly; all writes go through the
-- SECURITY DEFINER RPCs below (generate_sticker_batch, approve_bike).
create policy "stickers_select_authenticated"
  on stickers for select
  to authenticated
  using (true);

-- bikes_history: admins only read directly; all writes go through the
-- SECURITY DEFINER update_bike_registration RPC below.
create policy "bikes_history_select_authenticated"
  on bikes_history for select
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

-- Generates a batch of new available stickers, continuing numbering after
-- the highest tag number seen so far. Guards against colliding with tag
-- numbers assigned by the old direct-increment flow (condo_settings
-- next_tag_number) before this feature shipped, by also considering
-- bikes.tag_number, not just the new stickers table.
create function generate_sticker_batch(p_count int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created int;
begin
  -- Defense in depth: even though EXECUTE is revoked from public/anon below,
  -- guard against misconfigured grants by checking the caller's role here too.
  if auth.role() != 'authenticated' then
    raise exception 'not authorized';
  end if;

  if p_count is null or p_count <= 0 then
    raise exception 'p_count must be positive';
  end if;

  with next_seed as (
    select greatest(
      coalesce((select max(tag_number::int) from stickers), 0),
      coalesce((select max(tag_number::int) from bikes where tag_number ~ '^[0-9]+$'), 0)
    ) as seed
  ),
  inserted as (
    insert into stickers (tag_number)
    select lpad((seed + i)::text, greatest(3, length((seed + i)::text)), '0')
    from next_seed, generate_series(1, p_count) as i
    -- Belt-and-suspenders: if a tag number somehow already exists, skip it
    -- instead of aborting the whole batch, and report the real count created.
    on conflict (tag_number) do nothing
    returning tag_number
  )
  select count(*) into v_created from inserted;

  return v_created;
end;
$$;

-- Not granted to anon — only admins generate sticker batches. Postgres
-- grants EXECUTE on new functions to PUBLIC by default, which implicitly
-- includes anon, so we must explicitly revoke it after creating the function.
revoke execute on function generate_sticker_batch(int) from public;
revoke execute on function generate_sticker_batch(int) from anon;
grant execute on function generate_sticker_batch(int) to authenticated;

-- Atomically claims one available sticker from the pool and activates the
-- pending bike with it. Replaces the old condo_settings.next_tag_number
-- increment. `for update skip locked` avoids a race between concurrent
-- approvals claiming the same sticker: if two admins approve at the same
-- time, each claim locks a distinct available row and the second claim
-- simply skips the row the first already locked, picking the next lowest
-- available tag number instead of colliding or blocking.
create function approve_bike(p_bike_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag text;
begin
  -- Defense in depth: even though EXECUTE is revoked from public/anon below,
  -- guard against misconfigured grants by checking the caller's role here too.
  if auth.role() != 'authenticated' then
    raise exception 'not authorized';
  end if;

  update stickers set status = 'assigned', bike_id = p_bike_id
  where tag_number = (
    select tag_number from stickers where status = 'available'
    order by tag_number::int limit 1 for update skip locked
  )
  returning tag_number into v_tag;

  if v_tag is null then
    raise exception 'Nenhum adesivo disponível. Gere um novo lote.';
  end if;

  update bikes
  set tag_number = v_tag, status = 'active'
  where id = p_bike_id and status = 'pending';

  if not found then
    raise exception 'bike is not pending or does not exist';
  end if;

  return v_tag;
end;
$$;

-- Not granted to anon — only admins approve bikes. Postgres grants EXECUTE on
-- new functions to PUBLIC by default, which implicitly includes anon, so we
-- must explicitly revoke it after creating the function.
revoke execute on function approve_bike(uuid) from public;
revoke execute on function approve_bike(uuid) from anon;
grant execute on function approve_bike(uuid) to authenticated;

-- Edits a bike's registration fields, snapshotting the pre-edit row into
-- bikes_history first. If p_bike_id does not exist, the insert into
-- bikes_history affects zero rows, `not found` fires, and the function
-- raises before the update to bikes ever runs — so a bad id leaves both
-- tables untouched.
create function update_bike_registration(
  p_bike_id uuid,
  p_unit_block text,
  p_owner_name text,
  p_owner_whatsapp text,
  p_brand_model text,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Defense in depth: even though EXECUTE is revoked from public/anon below,
  -- guard against misconfigured grants by checking the caller's role here too.
  if auth.role() != 'authenticated' then
    raise exception 'not authorized';
  end if;

  insert into bikes_history (
    bike_id, tag_number, unit_block, owner_name, owner_whatsapp,
    brand_model, color, photo_url, status, created_at, edited_by
  )
  select id, tag_number, unit_block, owner_name, owner_whatsapp,
         brand_model, color, photo_url, status, created_at, auth.uid()
  from bikes where id = p_bike_id;

  if not found then
    raise exception 'bike not found';
  end if;

  update bikes set
    unit_block = p_unit_block,
    owner_name = p_owner_name,
    owner_whatsapp = p_owner_whatsapp,
    brand_model = p_brand_model,
    color = p_color
  where id = p_bike_id;
end;
$$;

-- Not granted to anon — only admins edit bike registrations. Postgres grants
-- EXECUTE on new functions to PUBLIC by default, which implicitly includes
-- anon, so we must explicitly revoke it after creating the function.
revoke execute on function update_bike_registration(uuid,text,text,text,text,text) from public;
revoke execute on function update_bike_registration(uuid,text,text,text,text,text) from anon;
grant execute on function update_bike_registration(uuid,text,text,text,text,text) to authenticated;
