export class AccountRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createAccount(client, { id, username, passwordHash }) {
    const result = await client.query(
      `INSERT INTO accounts (id, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, created_at`,
      [id, username, passwordHash],
    );
    return result.rows[0];
  }

  async findAccountForLogin(username) {
    const result = await this.pool.query(
      `SELECT id, username, password_hash, created_at
       FROM accounts
        WHERE username = $1
          AND NOT EXISTS (
            SELECT 1
              FROM account_deletion_requests d
             WHERE d.account_id = accounts.id
               AND d.status = 'queued'
          )`,
      [username],
    );
    return result.rows[0] ?? null;
  }

  async findAccountByIdForUpdate(client, accountId) {
    const result = await client.query(
      `SELECT id, username, password_hash, created_at
         FROM accounts WHERE id = $1 FOR UPDATE`,
      [accountId],
    );
    return result.rows[0] ?? null;
  }

  async updatePassword(client, accountId, passwordHash) {
    await client.query("UPDATE accounts SET password_hash = $2 WHERE id = $1", [accountId, passwordHash]);
  }

  async createSession(client, { id, accountId, tokenHash, expiresAt }) {
    await client.query(
      `INSERT INTO account_sessions (id, account_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, accountId, tokenHash, expiresAt],
    );
  }

  async findAccountBySessionHash(tokenHash) {
    const result = await this.pool.query(
      `SELECT a.id, a.username, a.created_at
         FROM account_sessions s
         JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async revokeSession(tokenHash) {
    await this.pool.query(
      `UPDATE account_sessions
          SET revoked_at = now()
        WHERE token_hash = $1
          AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async revokeAllSessions(client, accountId) {
    await client.query(
      `UPDATE account_sessions SET revoked_at = COALESCE(revoked_at, now())
        WHERE account_id = $1`,
      [accountId],
    );
  }

  async queueDeletion(client, { accountId, deleteAfter }) {
    await client.query(
      `INSERT INTO account_deletion_requests (account_id, delete_after)
       VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET delete_after = EXCLUDED.delete_after, status = 'queued'`,
      [accountId, deleteAfter],
    );
  }

  async exportData(client, accountId) {
    const profile = await client.query("SELECT version, payload, updated_at FROM player_profiles WHERE account_id = $1", [accountId]);
    const ledger = await client.query("SELECT currency, delta, source_type, source_id, created_at FROM currency_ledger WHERE account_id = $1 ORDER BY id", [accountId]);
    const inventory = await client.query("SELECT item_id, quantity, source_type, source_id, created_at FROM inventory_entries WHERE account_id = $1 ORDER BY id", [accountId]);
    const battles = await client.query("SELECT id, level_id, status, snapshot, result, event_log, event_log_hash, created_at, settled_at FROM battle_records WHERE account_id = $1 ORDER BY created_at", [accountId]);
    const audit = await client.query("SELECT action_type, payload_hash, created_at FROM account_audit_log WHERE account_id = $1 ORDER BY id", [accountId]);
    return {
      profile: profile.rows[0] ?? null,
      currencyLedger: ledger.rows,
      inventoryEntries: inventory.rows,
      battles: battles.rows,
      audit: audit.rows,
    };
  }
}
