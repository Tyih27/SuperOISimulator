CREATE TABLE arena_defenses (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  profile_version integer NOT NULL CHECK (profile_version >= 1),
  snapshot jsonb NOT NULL,
  rating integer NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  battles_won integer NOT NULL DEFAULT 0 CHECK (battles_won >= 0),
  battles_lost integer NOT NULL DEFAULT 0 CHECK (battles_lost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE arena_matches (
  id uuid PRIMARY KEY,
  attacker_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  defender_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  seed text NOT NULL,
  attacker_snapshot jsonb NOT NULL,
  defender_snapshot jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'settled')),
  result jsonb,
  attacker_events jsonb,
  defender_events jsonb,
  attacker_events_hash char(64),
  defender_events_hash char(64),
  attacker_rating_before integer NOT NULL,
  defender_rating_before integer NOT NULL,
  attacker_rating_after integer,
  defender_rating_after integer,
  reward_ledger_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK ((status = 'started' AND result IS NULL AND settled_at IS NULL)
    OR (status = 'settled' AND result IS NOT NULL AND settled_at IS NOT NULL))
);

CREATE INDEX arena_matches_attacker_created_at ON arena_matches (attacker_id, created_at DESC);
CREATE INDEX arena_matches_defender_created_at ON arena_matches (defender_id, created_at DESC);
