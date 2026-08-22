CREATE TABLE profile_snapshots (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_version integer NOT NULL CHECK (profile_version >= 1),
  action_type text NOT NULL CHECK (action_type <> ''),
  profile jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profile_snapshots_account_created_at
  ON profile_snapshots (account_id, created_at, id);
