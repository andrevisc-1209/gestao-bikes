-- Migration: deactivation reason/notes on bikes_history and the
-- deactivate_bike RPC for deactivating a bike with an audit trail. Run
-- against an existing Supabase project that already has schema.sql and
-- migration_bike_edit_history.sql applied (SQL editor). Idempotent: safe
-- to re-run.

-- 1. Columns --------------------------------------------------------------------

alter table bikes_history add column if not exists action text not null default 'edit' check (action in ('edit', 'deactivate'));
alter table bikes_history add column if not exists reason text;
alter table bikes_history add column if not exists notes text;

-- (update_bike_registration's existing insert is unchanged — it doesn't set
-- action/reason/notes, so those rows default to action = 'edit' with
-- reason/notes null, exactly as before.)

-- 2. RPCs -------------------------------------------------------------------------

-- Deactivates a bike, snapshotting the post-deactivation row into
-- bikes_history as a single data-modifying CTE: the update and the insert
-- happen as one atomic, naturally-guarded statement. If p_bike_id does not
-- exist, or the bike is already inactive, the update affects zero rows, so
-- the CTE returns no rows, the insert...select affects zero rows, `not
-- found` fires, and the function raises — nothing is written to either
-- table. This also makes a double-fire (two admin tabs, a retried click)
-- safe: the second call's update is a no-op, so it writes no second
-- history row.
create or replace function deactivate_bike(
  p_bike_id uuid,
  p_reason text,
  p_notes text
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

  with updated as (
    update bikes set status = 'inactive'
    where id = p_bike_id and status != 'inactive'
    returning *
  )
  insert into bikes_history (
    bike_id, tag_number, unit_block, owner_name, owner_whatsapp,
    brand_model, color, photo_url, status, created_at, action, reason, notes, edited_by
  )
  select id, tag_number, unit_block, owner_name, owner_whatsapp,
         brand_model, color, photo_url, status, created_at, 'deactivate', p_reason, p_notes, auth.uid()
  from updated;

  if not found then
    raise exception 'bike not found or already inactive';
  end if;
end;
$$;

-- Not granted to anon — only admins deactivate bikes. Postgres grants
-- EXECUTE on new functions to PUBLIC by default, which implicitly includes
-- anon, so we must explicitly revoke it after creating the function.
revoke execute on function deactivate_bike(uuid,text,text) from public;
revoke execute on function deactivate_bike(uuid,text,text) from anon;
grant execute on function deactivate_bike(uuid,text,text) to authenticated;
