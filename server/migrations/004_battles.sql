CREATE TABLE battle_records (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  level_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'settled')),
  snapshot jsonb NOT NULL,
  result jsonb,
  event_log jsonb,
  event_log_hash char(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK ((status = 'started' AND result IS NULL AND event_log IS NULL AND event_log_hash IS NULL AND settled_at IS NULL)
    OR (status = 'settled' AND result IS NOT NULL AND event_log IS NOT NULL AND event_log_hash IS NOT NULL AND settled_at IS NOT NULL))
);

CREATE INDEX battle_records_account_created_at ON battle_records (account_id, created_at DESC);
