export class BossRepository {
  async countChallengesOnDay(client, accountId, timeZone) {
    const result = await client.query(
      `SELECT count(*)::int AS total FROM boss_challenges
        WHERE account_id = $1
          AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
      [accountId, timeZone],
    );
    return result.rows[0]?.total ?? 0;
  }

  async createChallenge(client, values) {
    const result = await client.query(
      `INSERT INTO boss_challenges (id, account_id, seed, snapshot, status)
       VALUES ($1, $2, $3, $4::jsonb, 'started')
       RETURNING *`,
      [values.id, values.accountId, values.seed, JSON.stringify(values.snapshot)],
    );
    return result.rows[0];
  }

  async getChallenge(client, id, lock = false) {
    const result = await client.query(`SELECT * FROM boss_challenges WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [id]);
    return result.rows[0] ?? null;
  }

  async settleChallenge(client, values) {
    const result = await client.query(
      `UPDATE boss_challenges SET status = 'settled', result = $2::jsonb, events = $3::jsonb,
        events_hash = $4, damage = $5, reward_coins = $6, reward_ledger_id = $7, settled_at = now()
       WHERE id = $1 AND status = 'started' RETURNING *`,
      [values.id, JSON.stringify(values.result), JSON.stringify(values.events), values.eventsHash,
        values.damage, values.rewardCoins, values.rewardLedgerId ?? null],
    );
    return result.rows[0] ?? null;
  }

  async listChallenges(client, accountId, limit = 20) {
    const result = await client.query(
      `SELECT id, status, damage, reward_coins, created_at, settled_at
         FROM boss_challenges WHERE account_id = $1
        ORDER BY created_at DESC LIMIT $2`,
      [accountId, Math.min(Math.max(Number(limit) || 20, 1), 100)],
    );
    return result.rows;
  }
}
