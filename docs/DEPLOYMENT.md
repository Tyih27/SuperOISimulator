# Deployment

The production image runs the Node 22 API and browser assets from one origin. `server/start.js` validates configuration, applies every pending SQL migration, and only then starts listening.

## Required configuration

Set `DATABASE_URL`, `SESSION_SECRET` (at least 32 random characters), `APP_ORIGIN`, and `SECURE_COOKIES`. `APP_ORIGIN` accepts a comma-separated allowlist of full HTTP(S) origins, for example `https://oisimulator.example.com,https://www.oisimulator.example.com`; do not include paths. Use `SECURE_COOKIES=true` behind HTTPS. `POSTGRES_*` values are required by the production Compose file; keep them in a secret store rather than committing them.

## Compose deployment

```bash
export POSTGRES_USER=super_oi POSTGRES_PASSWORD='use-a-secret' POSTGRES_DB=super_oi
export SESSION_SECRET="$(openssl rand -base64 48)"
export APP_ORIGIN=https://oisimulator.example.com SECURE_COOKIES=true
docker compose -f docker-compose.production.yml up -d --build
curl --fail "$APP_ORIGIN/health"
```

Terminate with `docker compose -f docker-compose.production.yml down`. Back up PostgreSQL before upgrades; migrations are append-only and tracked in `schema_migrations`.

## Release verification

Run `npm run test:container` on a host with Docker. The smoke test builds the image, waits for `/health`, and removes its temporary database volume on exit.
