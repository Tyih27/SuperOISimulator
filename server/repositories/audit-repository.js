import { createHash } from "node:crypto";

export function payloadHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

export class AuditRepository {
  async append(client, { accountId, actionType, payload = null }) {
    await client.query(
      `INSERT INTO account_audit_log (account_id, action_type, payload_hash)
       VALUES ($1, $2, $3)`,
      [accountId, actionType, payloadHash(payload)],
    );
  }

  async list(pool, accountId) {
    const result = await pool.query(
      `SELECT action_type, payload_hash, created_at
         FROM account_audit_log
        WHERE account_id = $1
        ORDER BY id`,
      [accountId],
    );
    return result.rows;
  }
}
