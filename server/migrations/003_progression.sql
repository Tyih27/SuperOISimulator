CREATE TABLE currency_ledger (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('trainingCoins', 'recruitmentTickets')),
  delta integer NOT NULL CHECK (delta <> 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX currency_ledger_account_created_at ON currency_ledger (account_id, created_at);

CREATE TABLE inventory_entries (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  source_type text NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_entries_account_created_at ON inventory_entries (account_id, created_at);

CREATE TABLE campaign_settlements (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  settlement_id text NOT NULL,
  level_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, settlement_id)
);

CREATE TABLE shop_purchase_limits (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  offer_id text NOT NULL,
  reset_period text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, offer_id, reset_period)
);
