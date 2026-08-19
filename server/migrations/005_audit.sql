CREATE TABLE account_audit_log (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type <> ''),
  payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_audit_log_account_created_at
  ON account_audit_log (account_id, created_at DESC);

CREATE TABLE account_deletion_requests (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  delete_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'completed', 'cancelled'))
);
