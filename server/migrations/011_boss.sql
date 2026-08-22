CREATE TABLE boss_challenges (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seed text NOT NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'settled')),
  result jsonb,
  events jsonb,
  events_hash char(64),
  damage integer NOT NULL DEFAULT 0 CHECK (damage >= 0),
  reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  reward_ledger_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK ((status = 'started' AND result IS NULL AND settled_at IS NULL)
    OR (status = 'settled' AND result IS NOT NULL AND settled_at IS NOT NULL))
);

CREATE INDEX boss_challenges_account_created_at ON boss_challenges (account_id, created_at DESC);
