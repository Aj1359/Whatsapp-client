-- ============================================================
-- WhatsApp Business Broadcast & Follow-up App — Initial Schema
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- CONTACTS
-- Primary key: mobile_number (E.164 format, e.g. +919876543210)
-- Client can update/upsert rows at any time
-- ----------------------------------------------------------------
create table if not exists contacts (
  mobile_number  text        primary key,              -- E.164 canonical
  display_name   text        not null,
  email          text,
  tags           text[]      not null default '{}',
  custom_fields  jsonb       not null default '{}',    -- any extra KV pairs from CSV/Excel
  is_active      boolean     not null default true,    -- soft delete / opt-out
  opted_out_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists contacts_tags_gin on contacts using gin(tags);
create index if not exists contacts_active on contacts(is_active);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- WA_CREDENTIALS (store one WABA per row; encrypted phone_number_id & token)
-- ----------------------------------------------------------------
create table if not exists wa_credentials (
  id                   uuid        primary key default gen_random_uuid(),
  label                text        not null,
  phone_number_id      text        not null,           -- Meta API phone number ID (stored encrypted)
  waba_id              text        not null,           -- WhatsApp Business Account ID
  access_token_enc     text        not null,           -- AES-256-GCM encrypted token
  verify_token         text        not null,           -- webhook verify token
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger wa_credentials_updated_at
  before update on wa_credentials
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- TEMPLATES (mirror of Meta-approved templates)
-- ----------------------------------------------------------------
create table if not exists templates (
  id              uuid        primary key default gen_random_uuid(),
  credential_id   uuid        not null references wa_credentials(id) on delete cascade,
  meta_template_id  text      not null,
  name            text        not null,
  language        text        not null default 'en',
  category        text        not null,               -- MARKETING / UTILITY / AUTHENTICATION
  components      jsonb       not null default '[]',  -- raw Meta template components
  status          text        not null default 'APPROVED',
  synced_at       timestamptz not null default now(),
  unique(credential_id, name, language)
);

-- ----------------------------------------------------------------
-- BROADCASTS
-- ----------------------------------------------------------------
create table if not exists broadcasts (
  id                 uuid        primary key default gen_random_uuid(),
  credential_id      uuid        not null references wa_credentials(id),
  template_id        uuid        references templates(id),
  name               text        not null,
  message_body       text,                            -- for plain-text / free-form messages
  media_url          text,                            -- optional image/video/doc URL
  scheduled_at       timestamptz,                     -- null = send immediately
  sent_at            timestamptz,
  status             text        not null default 'DRAFT',
                                                      -- DRAFT | SCHEDULED | SENDING | SENT | FAILED
  total_recipients   int         not null default 0,
  sent_count         int         not null default 0,
  delivered_count    int         not null default 0,
  read_count         int         not null default 0,
  failed_count       int         not null default 0,
  created_by         uuid,                            -- auth.users id
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists broadcasts_status on broadcasts(status);
create index if not exists broadcasts_scheduled_at on broadcasts(scheduled_at) where scheduled_at is not null;

create trigger broadcasts_updated_at
  before update on broadcasts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- BROADCAST_RECIPIENTS — one row per contact per broadcast
-- ----------------------------------------------------------------
create table if not exists broadcast_recipients (
  id               bigserial   primary key,
  broadcast_id     uuid        not null references broadcasts(id) on delete cascade,
  mobile_number    text        not null references contacts(mobile_number) on delete cascade,
  display_name     text        not null,              -- snapshot at send time
  wa_message_id    text,                              -- returned by Meta API
  status           text        not null default 'PENDING',
                                                      -- PENDING | SENT | DELIVERED | READ | FAILED | OPTED_OUT
  status_updated_at timestamptz,
  error_code       text,
  error_message    text,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create unique index if not exists br_broadcast_mobile on broadcast_recipients(broadcast_id, mobile_number);
create index if not exists br_broadcast_id on broadcast_recipients(broadcast_id);
create index if not exists br_wa_message_id on broadcast_recipients(wa_message_id) where wa_message_id is not null;
create index if not exists br_status on broadcast_recipients(status);
create index if not exists br_mobile_number on broadcast_recipients(mobile_number);

-- ----------------------------------------------------------------
-- FOLLOW_UPS — automated follow-up sequences attached to a broadcast
-- ----------------------------------------------------------------
create table if not exists follow_ups (
  id               uuid        primary key default gen_random_uuid(),
  broadcast_id     uuid        not null references broadcasts(id) on delete cascade,
  delay_hours      int         not null default 24,
  target_statuses  text[]      not null default '{"SENT","DELIVERED"}',
                                                      -- send follow-up to contacts with these statuses
  template_id      uuid        references templates(id),
  message_body     text,
  media_url        text,
  status           text        not null default 'PENDING',
                                                      -- PENDING | RUNNING | DONE | FAILED
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger follow_ups_updated_at
  before update on follow_ups
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- FOLLOW_UP_RECIPIENTS
-- ----------------------------------------------------------------
create table if not exists follow_up_recipients (
  id               bigserial   primary key,
  follow_up_id     uuid        not null references follow_ups(id) on delete cascade,
  mobile_number    text        not null references contacts(mobile_number),
  wa_message_id    text,
  status           text        not null default 'PENDING',
  status_updated_at timestamptz,
  error_code       text,
  error_message    text,
  sent_at          timestamptz,
  delivered_at     timestamptz,
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create unique index if not exists fur_followup_mobile on follow_up_recipients(follow_up_id, mobile_number);
create index if not exists fur_wa_message_id on follow_up_recipients(wa_message_id) where wa_message_id is not null;

-- ----------------------------------------------------------------
-- CONTACT_IMPORT_LOGS — audit trail of every bulk import
-- ----------------------------------------------------------------
create table if not exists contact_import_logs (
  id               uuid        primary key default gen_random_uuid(),
  file_name        text        not null,
  total_rows       int         not null default 0,
  inserted_rows    int         not null default 0,
  updated_rows     int         not null default 0,
  skipped_rows     int         not null default 0,
  error_rows       int         not null default 0,
  errors           jsonb       not null default '[]',
  imported_by      uuid,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------
alter table contacts              enable row level security;
alter table wa_credentials        enable row level security;
alter table templates             enable row level security;
alter table broadcasts            enable row level security;
alter table broadcast_recipients  enable row level security;
alter table follow_ups            enable row level security;
alter table follow_up_recipients  enable row level security;
alter table contact_import_logs   enable row level security;

-- Service role bypasses RLS (backend uses service role)
-- For authenticated users (staff), grant full access
create policy "Authenticated full access on contacts"             on contacts             for all to authenticated using (true) with check (true);
create policy "Authenticated full access on wa_credentials"       on wa_credentials       for all to authenticated using (true) with check (true);
create policy "Authenticated full access on templates"            on templates            for all to authenticated using (true) with check (true);
create policy "Authenticated full access on broadcasts"           on broadcasts           for all to authenticated using (true) with check (true);
create policy "Authenticated full access on broadcast_recipients" on broadcast_recipients for all to authenticated using (true) with check (true);
create policy "Authenticated full access on follow_ups"           on follow_ups           for all to authenticated using (true) with check (true);
create policy "Authenticated full access on follow_up_recipients" on follow_up_recipients for all to authenticated using (true) with check (true);
create policy "Authenticated full access on contact_import_logs"  on contact_import_logs  for all to authenticated using (true) with check (true);

