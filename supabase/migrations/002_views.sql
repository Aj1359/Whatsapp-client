-- ============================================================
-- Useful views & helper functions
-- ============================================================

-- Broadcast summary with read/delivered/sent breakdown
create or replace view broadcast_report as
select
  b.id,
  b.name,
  b.status,
  b.sent_at,
  b.total_recipients,
  b.sent_count,
  b.delivered_count,
  b.read_count,
  b.failed_count,
  round(b.read_count::numeric       / nullif(b.total_recipients,0) * 100, 1) as read_pct,
  round(b.delivered_count::numeric  / nullif(b.total_recipients,0) * 100, 1) as delivered_pct,
  round(b.failed_count::numeric     / nullif(b.total_recipients,0) * 100, 1) as failed_pct
from broadcasts b;

-- Per-recipient delivery status (used by report drill-down)
create or replace view recipient_report as
select
  br.broadcast_id,
  br.mobile_number,
  br.display_name,
  br.status,
  br.sent_at,
  br.delivered_at,
  br.read_at,
  br.error_code,
  br.error_message,
  c.tags,
  c.email,
  c.custom_fields
from broadcast_recipients br
join contacts c on c.mobile_number = br.mobile_number;

