CREATE TABLE campaign_clears (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  level_id text NOT NULL,
  cleared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, level_id)
);
