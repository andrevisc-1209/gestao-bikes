-- Migration: sticker pool schema, batch generation RPC, and pool-aware approve_bike.
-- Run against an existing Supabase project that already has schema.sql applied
-- (SQL editor), same as migration_security_fixes.sql. Idempotent: safe to
-- re-run.

-- 1. Table --------------------------------------------------------------------

-- Pool of pre-printed sticker tag numbers. Admins generate batches ahead of
-- time (generate_sticker_batch); approve_bike claims one atomically instead
-- of incrementing condo_settings.next_tag_number.
create table if not exists stickers (
  tag_number text primary key,
  status text not null default 'available' check (status in ('available', 'assigned')),
  bike_id uuid references bikes(id),
  created_at timestamptz not null default now()
);

-- 2. Grants + RLS ---------------------------------------------------------------

-- RLS policies alone are not enough: Postgres also requires the calling role
-- to hold the base table-level privilege. Without this grant, every request
-- fails with "permission denied for table stickers" even when the matching
-- RLS policy would allow the row.
grant select on stickers to authenticated;
-- no insert/update grant to anon or authenticated directly — only the
-- SECURITY DEFINER RPCs below ever write to this table.

alter table stickers enable row level security;

drop policy if exists "stickers_select_authenticated" on stickers;
create policy "stickers_select_authenticated"
  on stickers for select
  to authenticated
  using (true);

-- 3. RPCs -------------------------------------------------------------------------

-- Generates a batch of new available stickers, continuing numbering after
-- the highest tag number seen so far. Guards against colliding with tag
-- numbers assigned by the old direct-increment flow (condo_settings
-- next_tag_number) before this feature shipped, by also considering
-- bikes.tag_number, not just the new stickers table.
create or replace function generate_sticker_batch(p_count int)
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
create or replace function approve_bike(p_bike_id uuid)
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
