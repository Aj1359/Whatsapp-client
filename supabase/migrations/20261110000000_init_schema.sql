-- ============================================================
-- WhatsApp Business Broadcast & Follow-up Web App
-- Migration: 20261110000000_init_schema.sql
-- Exact schema matching PRD Pages 5-8
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  platform_admin boolean not null default false
);

-- Memberships
create table if not exists memberships (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  primary key (org_id, user_id)
);

-- WhatsApp Accounts
create table if not exists whatsapp_accounts (
  org_id uuid primary key references organizations(id) on delete cascade,
  phone_number_id text not null,
  waba_id text not null,
  token_encrypted text not null, -- AES-256-GCM, key in env ENCRYPTION_KEY
  app_secret_encrypted text, -- only if this client uses its own Meta app
  graph_version text not null default 'v21.0',
  display_phone text,
  verified_name text,
  quality_rating text,
  updated_at timestamptz default now()
);
create unique index if not exists idx_whatsapp_accounts_phone on whatsapp_accounts (phone_number_id);

-- Settings
create table if not exists settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  default_country text default 'IN',
  timezone text default 'Asia/Kolkata',
  send_rate_per_sec int default 20,
  daily_send_cap int default 250,
  weekly_cap_per_contact int default 3,
  rate_marketing numeric default 0.8631,
  rate_utility numeric default 0.115,
  gst_percent numeric default 18
);

-- Contacts (primary key id, unique per org and whatsapp_e164)
create table if not exists contacts (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  whatsapp_e164 text not null,
  phone_raw text,
  email text,
  extra jsonb,
  status text not null default 'active' check (status in ('active','opted_out','invalid','blocked')),
  opt_in_confirmed_at timestamptz,
  opt_in_source text,
  opted_out_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, whatsapp_e164)
);
create index if not exists idx_contacts_org_status on contacts(org_id, status);

-- Lists (Audiences)
create table if not exists lists (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- List Members
create table if not exists list_members (
  list_id bigint references lists(id) on delete cascade,
  contact_id bigint references contacts(id) on delete cascade,
  primary key (list_id, contact_id)
);

-- Imports
create table if not exists imports (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  filename text,
  total int,
  valid int,
  invalid int,
  duplicate int,
  created_at timestamptz default now()
);

-- Import Errors
create table if not exists import_errors (
  id bigint generated always as identity primary key,
  import_id bigint references imports(id) on delete cascade,
  row_number int,
  reason text,
  raw jsonb
);

-- Templates
create table if not exists templates (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  language text not null default 'en',
  category text not null check (category in ('marketing','utility')),
  header_type text not null check (header_type in ('image','none')),
  body text not null,
  variable_names text[] not null default '{}',
  footer text,
  meta_template_id text,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected','paused')),
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, name, language)
);

-- Campaigns
create table if not exists campaigns (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('broadcast','daily','followup')),
  template_id bigint not null references templates(id),
  list_id bigint not null references lists(id),
  image_path text,
  media_id text,
  media_uploaded_at timestamptz,
  variables jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','running','paused','completed','cancelled','failed')),
  pause_reason text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total int default 0,
  created_by uuid,
  created_at timestamptz default now()
);

-- Daily Entries (for daily planner)
create table if not exists daily_entries (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  send_date date not null,
  send_time time not null,
  template_id bigint not null,
  list_id bigint not null,
  image_path text,
  variables jsonb,
  campaign_id bigint,
  status text not null default 'planned' check (status in ('planned','sent','missed','skipped')),
  unique (org_id, send_date, template_id, list_id)
);

-- Messages
create table if not exists messages (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  contact_id bigint not null references contacts(id),
  step_id bigint,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','read','failed','skipped')),
  wa_message_id text unique,
  attempt_count int default 0,
  next_attempt_at timestamptz default now(),
  error_code text,
  error_message text,
  queued_at timestamptz default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz
);
create index if not exists idx_messages_status_next on messages (status, next_attempt_at);
create index if not exists idx_messages_campaign_status on messages (campaign_id, status);
create index if not exists idx_messages_contact_id on messages (contact_id);

-- Inbound Messages
create table if not exists inbound_messages (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  contact_id bigint,
  from_e164 text not null,
  wa_message_id text unique,
  body text,
  media jsonb,
  is_stop boolean default false,
  handled boolean default false,
  received_at timestamptz not null
);

-- Sequences (Follow-up sequences)
create table if not exists sequences (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  name text,
  trigger_campaign_id bigint,
  active boolean default true
);

-- Sequence Steps
create table if not exists sequence_steps (
  id bigint generated always as identity primary key,
  sequence_id bigint references sequences(id) on delete cascade,
  step_no int not null,
  delay_hours int not null,
  template_id bigint not null,
  image_path text,
  variables jsonb,
  condition text not null check (condition in ('always','no_reply','delivered_not_read','read_no_reply','failed'))
);

-- Sequence State (per contact per sequence)
create table if not exists sequence_state (
  contact_id bigint references contacts(id) on delete cascade,
  sequence_id bigint references sequences(id) on delete cascade,
  current_step int not null default 1,
  next_run_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','exited_reply','exited_optout','exited_manual')),
  primary key (contact_id, sequence_id)
);

-- Webhook Events (raw log with 30-day retention)
create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  org_id uuid,
  received_at timestamptz default now(),
  payload jsonb not null,
  processed_at timestamptz
);

-- Audit Log
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  user_id uuid,
  at timestamptz default now(),
  action text not null,
  detail jsonb
);

-- Security: RLS on, no policies (backend connects with privileged connection string / service-role)
do $$ declare t text; begin
for t in select tablename from pg_tables where schemaname = 'public' loop
  execute format('alter table public.%I enable row level security', t);
end loop; end $$;

