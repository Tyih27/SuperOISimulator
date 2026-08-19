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
        WHERE username = $1`,
      [username],
    );
    return result.rows[0] ?? null;
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
}
