function metric(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

export async function metricsRoutes(app) {
  app.get("/metrics", async (request, reply) => {
    let accounts = 0;
    let activeSessions = 0;
    let battles = 0;
    try {
      const result = await app.db.query(`
        SELECT
          (SELECT count(*)::int FROM accounts) AS accounts,
          (SELECT count(*)::int FROM account_sessions WHERE revoked_at IS NULL AND expires_at > now()) AS active_sessions,
          (SELECT count(*)::int FROM battle_records) AS battles
      `);
      ({ accounts, active_sessions: activeSessions, battles } = result.rows[0] ?? {});
    } catch (error) {
      request.log.error({ err: error }, "metrics database query failed");
      return reply.code(503).type("text/plain; version=0.0.4; charset=utf-8").send(
        "super_oi_up 0\n",
      );
    }

    const body = [
      "# HELP super_oi_up Whether the application and database are available.",
      "# TYPE super_oi_up gauge",
      "super_oi_up 1",
      "# HELP super_oi_process_uptime_seconds Process uptime in seconds.",
      "# TYPE super_oi_process_uptime_seconds gauge",
      `super_oi_process_uptime_seconds ${metric(process.uptime())}`,
      "# HELP super_oi_accounts_total Number of registered accounts.",
      "# TYPE super_oi_accounts_total gauge",
      `super_oi_accounts_total ${metric(accounts)}`,
      "# HELP super_oi_active_sessions Number of currently active sessions.",
      "# TYPE super_oi_active_sessions gauge",
      `super_oi_active_sessions ${metric(activeSessions)}`,
      "# HELP super_oi_battles_total Number of stored campaign battles.",
      "# TYPE super_oi_battles_total gauge",
      `super_oi_battles_total ${metric(battles)}`,
      "",
    ].join("\n");
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(body);
  });
}
