export class ArenaRepository {
  async getDefense(client, accountId, lock = false) {
    const result = await client.query(
      `SELECT account_id, profile_version, snapshot, rating, battles_won, battles_lost, updated_at
         FROM arena_defenses WHERE account_id = $1 ${lock ? "FOR UPDATE" : ""}`,
      [accountId],
    );
    return result.rows[0] ?? null;
  }

  async saveDefense(client, { accountId, profileVersion, snapshot }) {
    const result = await client.query(
      `INSERT INTO arena_defenses (account_id, profile_version, snapshot)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (account_id) DO UPDATE SET profile_version = EXCLUDED.profile_version,
         snapshot = EXCLUDED.snapshot, updated_at = now()
       RETURNING account_id, profile_version, snapshot, rating, battles_won, battles_lost, updated_at`,
      [accountId, profileVersion, JSON.stringify(snapshot)],
    );
    return result.rows[0];
  }

  async listOpponents(client, accountId, limit = 10) {
    const result = await client.query(
      `SELECT account_id, rating, battles_won, battles_lost, updated_at
         FROM arena_defenses WHERE account_id <> $1
        ORDER BY abs(rating - COALESCE((SELECT rating FROM arena_defenses WHERE account_id = $1), 1000)), account_id
        LIMIT $2`,
      [accountId, limit],
    );
    return result.rows;
  }

  async createMatch(client, values) {
    const result = await client.query(
      `INSERT INTO arena_matches
       (id, attacker_id, defender_id, seed, attacker_snapshot, defender_snapshot,
        attacker_rating_before, defender_rating_before, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, 'started')
       RETURNING *`,
      [values.id, values.attackerId, values.defenderId, values.seed,
        JSON.stringify(values.attackerSnapshot), JSON.stringify(values.defenderSnapshot),
        values.attackerRatingBefore, values.defenderRatingBefore],
    );
    return result.rows[0];
  }

  async getMatch(client, id, lock = false) {
    const result = await client.query(`SELECT * FROM arena_matches WHERE id = $1 ${lock ? "FOR UPDATE" : ""}`, [id]);
    return result.rows[0] ?? null;
  }

  async settleMatch(client, values) {
    const result = await client.query(
      `UPDATE arena_matches SET status = 'settled', result = $2::jsonb,
        attacker_events = $3::jsonb, defender_events = $4::jsonb,
        attacker_events_hash = $5, defender_events_hash = $6,
        attacker_rating_after = $7, defender_rating_after = $8,
        reward_ledger_id = $9, settled_at = now()
       WHERE id = $1 AND status = 'started' RETURNING *`,
      [values.id, JSON.stringify(values.result), JSON.stringify(values.attackerEvents),
        JSON.stringify(values.defenderEvents), values.attackerEventsHash, values.defenderEventsHash,
        values.attackerRatingAfter, values.defenderRatingAfter, values.rewardLedgerId ?? null],
    );
    return result.rows[0] ?? null;
  }

  async updateRatings(client, { attackerId, defenderId, attackerRating, defenderRating, winner }) {
    await client.query(
      `UPDATE arena_defenses SET rating = $2, battles_won = battles_won + $3,
        battles_lost = battles_lost + $4, updated_at = now() WHERE account_id = $1`,
      [attackerId, attackerRating, winner === "attacker" ? 1 : 0, winner === "defender" ? 1 : 0],
    );
    await client.query(
      `UPDATE arena_defenses SET rating = $2, battles_won = battles_won + $3,
        battles_lost = battles_lost + $4, updated_at = now() WHERE account_id = $1`,
      [defenderId, defenderRating, winner === "defender" ? 1 : 0, winner === "attacker" ? 1 : 0],
    );
  }
}
