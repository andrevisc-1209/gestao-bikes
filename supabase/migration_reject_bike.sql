-- Migration: lets the admin reject a pending registration. Adds the
-- 'rejected' bike status, the 'reject' history action and the reject_bike
-- RPC. Run in the Supabase SQL editor on a project that already has
-- migration_deactivation_reason.sql applied. Idempotent: safe to re-run.
--
-- Run PART 1 on its own first, then PART 2: Postgres only lets a new enum
-- value be used after the statement that added it has been committed.

-- PART 1 ----------------------------------------------------------------------

alter type bike_status add value if not exists 'rejected';

-- PART 2 ----------------------------------------------------------------------

alter table bikes_history drop constraint if exists bikes_history_action_check;
alter table bikes_history add constraint bikes_history_action_check
  check (action in ('edit', 'deactivate', 'reject'));

-- Rejects a pending bike and snapshots it into bikes_history, as one atomic
-- statement. Only pending bikes can be rejected: an approved, inactive or
-- already rejected bike makes the update affect zero rows, so nothing is
-- written and the function raises. A double click is therefore harmless.
create or replace function reject_bike(
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
  if auth.role() != 'authenticated' then
    raise exception 'not authorized';
  end if;

  with updated as (
    update bikes set status = 'rejected'
    where id = p_bike_id and status = 'pending'
    returning *
  )
  insert into bikes_history (
    bike_id, tag_number, unit_block, owner_name, owner_whatsapp,
    brand_model, color, photo_url, status, created_at, action, reason, notes, edited_by
  )
  select id, tag_number, unit_block, owner_name, owner_whatsapp,
         brand_model, color, photo_url, status, created_at, 'reject', p_reason, p_notes, auth.uid()
  from updated;

  if not found then
    raise exception 'Este cadastro não está mais pendente.';
  end if;
end;
$$;

revoke execute on function reject_bike(uuid,text,text) from public;
revoke execute on function reject_bike(uuid,text,text) from anon;
grant execute on function reject_bike(uuid,text,text) to authenticated;
