# Security

- Serve production traffic over HTTPS and set `SECURE_COOKIES=true`; sessions are signed, HttpOnly, same-origin cookies and are stored server-side as SHA-256 token hashes.
- Keep `SESSION_SECRET`, database credentials, and `APP_ORIGIN` outside source control. Rotate the session secret only during a planned session invalidation.
- Mutating cookie-authenticated routes enforce the configured `Origin` and authentication routes are rate limited.
- The browser never submits rewards, currency, battle seeds, or settlement results. The server owns snapshots, event logs, hashes, and ledger writes.
- `/health` returns only readiness status. `/metrics` contains aggregate process/database counters and no usernames, account IDs, payloads, or request data; restrict it at the reverse proxy if exposed beyond localhost.
- Apply PostgreSQL backups, least-privilege network rules, dependency updates, and migration review as part of each release.
