ALTER TABLE accounts
  ADD COLUMN role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

CREATE INDEX accounts_role_idx ON accounts (role);

CREATE TABLE account_feedback (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('bug', 'suggestion', 'other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_feedback_created_at_idx ON account_feedback (created_at DESC);
