export class BattleRepository {
  async create(client, { id, accountId, levelId, snapshot }) {
    const result = await client.query(
      `INSERT INTO battle_records (id, account_id, level_id, status, snapshot)
       VALUES ($1, $2, $3, 'started', $4::jsonb)
       RETURNING id, account_id, level_id, status, snapshot, created_at`,
      [id, accountId, levelId, JSON.stringify(snapshot)],
    );
    return result.rows[0];
  }

  async findForUpdate(client, id) {
    const result = await client.query(
      `SELECT id, account_id, level_id, status, snapshot, result, event_log, event_log_hash,
              created_at, settled_at
         FROM battle_records
        WHERE id = $1
        FOR UPDATE`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async settle(client, { id, result, events, eventLogHash }) {
    const updated = await client.query(
      `UPDATE battle_records
          SET status = 'settled', result = $2::jsonb, event_log = $3::jsonb,
              event_log_hash = $4, settled_at = now()
        WHERE id = $1 AND status = 'started'
       RETURNING id, status, event_log_hash, settled_at`,
      [id, JSON.stringify(result), JSON.stringify(events), eventLogHash],
    );
    return updated.rows[0] ?? null;
  }
}
