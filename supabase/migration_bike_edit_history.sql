-- Migration: bikes_history table and update_bike_registration RPC for editing
-- an existing bike's registration with an audit trail. Run against an
-- existing Supabase project that already has schema.sql applied (SQL
-- editor), same as migration_security_fixes.sql. Idempotent: safe to re-run.

-- 1. Table --------------------------------------------------------------------

-- Snapshot of a bike's registration fields taken immediately before each
-- edit via update_bike_registration. Written only by that SECURITY DEFINER
-- RPC — never insert/update/delete here directly.
create table if not exists bikes_history (
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

-- 2. Grants + RLS ---------------------------------------------------------------

-- RLS policies alone are not enough: Postgres also requires the calling role
-- to hold the base table-level privilege. Without this grant, every request
-- fails with "permission denied for table bikes_history" even when the
-- matching RLS policy would allow the row.
grant select on bikes_history to authenticated;
-- No insert/update/delete grant to anyone — only update_bike_registration
-- (security definer) writes here.

alter table bikes_history enable row level security;

drop policy if exists "bikes_history_select_authenticated" on bikes_history;
create policy "bikes_history_select_authenticated"
  on bikes_history for select
  to authenticated
  using (true);

-- 3. RPCs -------------------------------------------------------------------------

-- Edits a bike's registration fields, snapshotting the pre-edit row into
-- bikes_history first. If p_bike_id does not exist, the insert into
-- bikes_history affects zero rows, `not found` fires, and the function
-- raises before the update to bikes ever runs — so a bad id leaves both
-- tables untouched.
create or replace function update_bike_registration(
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
