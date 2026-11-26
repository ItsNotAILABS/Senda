-- Senda Liquify / Bitso inbox + outbox (PostgreSQL).
-- Migrate only on a private server. No credentials or beneficiary PII stored here.
-- Database write transaction must commit event receipt AND worker job together.
CREATE SCHEMA IF NOT EXISTS bitso_business;

CREATE TABLE IF NOT EXISTS bitso_business.webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider = 'bitso'),
  account_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('funding','withdrawal')),
  provider_id TEXT NOT NULL,
  provider_status TEXT NOT NULL CHECK (provider_status IN ('pending','processing','complete','failed')),
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_state TEXT NOT NULL DEFAULT 'reconciliation_required'
    CHECK (processing_state IN ('reconciliation_required','reviewed','dead_letter')),
  CONSTRAINT bitso_inbox_key_scope CHECK (length(id) BETWEEN 20 AND 512)
);
CREATE INDEX IF NOT EXISTS bitso_inbox_account_resource
  ON bitso_business.webhook_inbox (account_id, event_type, provider_id, received_at DESC);

CREATE TABLE IF NOT EXISTS bitso_business.reconciliation_outbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inbox_id TEXT NOT NULL UNIQUE REFERENCES bitso_business.webhook_inbox(id),
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('funding','withdrawal')),
  job_kind TEXT NOT NULL CHECK (job_kind = 'bitso-provider-reconcile'),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','processing','done','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bitso_outbox_ready
  ON bitso_business.reconciliation_outbox (available_at,id) WHERE state='pending';

-- Workers should claim with FOR UPDATE SKIP LOCKED, retry with bounded backoff,
-- and dead-letter unresolved events. Never infer payout success from this queue.
-- Restrict table privileges to private dedicated DB roles; no browser SQL access.
