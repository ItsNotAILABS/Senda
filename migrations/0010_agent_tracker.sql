CREATE TABLE IF NOT EXISTS agent_tracker (
  id TEXT PRIMARY KEY,
  harness_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  mint TEXT NOT NULL,
  thesis TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (harness_id, symbol)
);
