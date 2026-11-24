-- Migration: adds resolution/resolution_notes columns to incidents, so
-- resolving an occurrence can record why and with what notes. Run against
-- an existing Supabase project that already has schema.sql applied (SQL
-- editor). Idempotent: safe to re-run. No RPC/grant change — incidents
-- already grants authenticated a direct update.

alter table incidents add column if not exists resolution text;
alter table incidents add column if not exists resolution_notes text;
