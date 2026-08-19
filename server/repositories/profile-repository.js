export class ProfileRepository {
  async findByAccountId(accountId) {
    const result = await this.pool.query(
      `SELECT account_id, version, payload, updated_at
         FROM player_profiles
        WHERE account_id = $1`,
      [accountId],
    );
    return result.rows[0] ?? null;
  }

  constructor(pool) {
    this.pool = pool;
  }

  async findOrCreateForUpdate(client, { accountId, profile }) {
    const existing = await client.query(
      `SELECT account_id, version, payload, updated_at
         FROM player_profiles
        WHERE account_id = $1
        FOR UPDATE`,
      [accountId],
    );
    if (existing.rowCount === 1) return existing.rows[0];

    const inserted = await client.query(
      `INSERT INTO player_profiles (account_id, version, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (account_id) DO NOTHING
       RETURNING account_id, version, payload, updated_at`,
      [accountId, profile.version, JSON.stringify(profile)],
    );
    if (inserted.rowCount === 1) return inserted.rows[0];

    const concurrent = await client.query(
      `SELECT account_id, version, payload, updated_at
         FROM player_profiles
        WHERE account_id = $1
        FOR UPDATE`,
      [accountId],
    );
    if (concurrent.rowCount === 1) return concurrent.rows[0];
    throw new Error("Could not create player profile");
  }

  async update(client, { accountId, version, profile }) {
    const result = await client.query(
      `UPDATE player_profiles
          SET version = $2,
              payload = $3::jsonb,
              updated_at = now()
        WHERE account_id = $1
       RETURNING account_id, version, payload, updated_at`,
      [accountId, version, JSON.stringify(profile)],
    );
    return result.rows[0];
  }
}
