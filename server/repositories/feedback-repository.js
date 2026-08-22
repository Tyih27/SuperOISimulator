export class FeedbackRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ id, accountId, category, message }) {
    const result = await this.pool.query(
      `INSERT INTO account_feedback (id, account_id, category, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, account_id, category, message, created_at`,
      [id, accountId, category, message],
    );
    return result.rows[0];
  }

  async list({ limit = 100 } = {}) {
    const result = await this.pool.query(
      `SELECT f.id, f.account_id, a.username, f.category, f.message, f.created_at
         FROM account_feedback f
         JOIN accounts a ON a.id = f.account_id
        ORDER BY f.created_at DESC
        LIMIT $1`,
      [limit],
    );
    return result.rows;
  }
}
