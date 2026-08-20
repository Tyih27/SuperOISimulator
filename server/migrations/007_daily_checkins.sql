CREATE TABLE daily_checkins (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  claim_period date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, claim_period)
);

CREATE INDEX daily_checkins_account_claimed_at
  ON daily_checkins (account_id, claimed_at DESC);
