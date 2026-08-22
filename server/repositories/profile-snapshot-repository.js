export class ProfileSnapshotRepository {
  async create(client, { accountId, profileVersion, actionType, profile }) {
    const result = await client.query(
      `INSERT INTO profile_snapshots (account_id, profile_version, action_type, profile)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, account_id, profile_version, action_type, profile, created_at`,
      [accountId, profileVersion, actionType, JSON.stringify(profile)],
    );
    return result.rows[0];
  }

  async listForAccount(client, accountId) {
    const result = await client.query(
      `SELECT id, account_id, profile_version, action_type, profile, created_at
         FROM profile_snapshots
        WHERE account_id = $1
        ORDER BY id`,
      [accountId],
    );
    return result.rows;
  }
}
