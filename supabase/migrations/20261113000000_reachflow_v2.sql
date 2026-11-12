-- ============================================================
-- Migration: 20261113000000_reachflow_v2.sql
-- ReachFlow V2: Schema enhancements & unification
-- ============================================================

-- 1. whatsapp_accounts: Forwarding configuration
alter table public.whatsapp_accounts
  add column if not exists forward_enabled boolean not null default false,
  add column if not exists forward_to_e164 text,
  add column if not exists forward_template_name text,
  add column if not exists forward_template_language text not null default 'en';

-- 2. templates: Add components, header_format; relax category, status, and header_type constraints
alter table public.templates
  add column if not exists components jsonb,
  add column if not exists header_format text;

-- Drop old check constraints on templates if they exist
alter table public.templates drop constraint if exists templates_category_check;
alter table public.templates drop constraint if exists templates_status_check;
alter table public.templates drop constraint if exists templates_header_type_check;

-- Add updated, relaxed check constraints
alter table public.templates
  add constraint templates_category_check
    check (category in ('marketing', 'utility', 'authentication')),
  add constraint templates_status_check
    check (status in ('approved', 'pending', 'rejected', 'paused', 'disabled', 'in_appeal', 'draft')),
  add constraint templates_header_type_check
    check (header_type in ('image', 'video', 'document', 'text', 'none'));

-- 3. messages: Add locked_at for sweeper worker
alter table public.messages
  add column if not exists locked_at timestamptz;

-- 4. inbound_messages: Add handling, campaign matching, and forward tracking
alter table public.inbound_messages
  add column if not exists handled boolean not null default false,
  add column if not exists matched_message_id bigint,
  add column if not exists matched_campaign_id bigint,
  add column if not exists forwarded_at timestamptz;

-- 5. outbound_replies: Threaded follow-up replies sent directly from portal
create table if not exists public.outbound_replies (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id bigint not null references public.contacts(id) on delete cascade,
  to_e164 text not null,
  body text not null,
  wa_message_id text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);
create index if not exists idx_outbound_replies_org_contact on public.outbound_replies(org_id, contact_id);
create index if not exists idx_outbound_replies_wa_id on public.outbound_replies(wa_message_id);

-- 6. forwards: Audit log for notifications forwarded to user's personal WhatsApp
create table if not exists public.forwards (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  inbound_message_id bigint references public.inbound_messages(id) on delete set null,
  to_e164 text not null,
  mode text not null check (mode in ('template', 'freeform')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  wa_message_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_forwards_org on public.forwards(org_id);

-- 7. Enable RLS on every table (backend connections use privileged/service connection)
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

