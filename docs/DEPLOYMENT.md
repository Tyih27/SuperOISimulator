# Deployment

The production image runs the Node 22 API and browser assets from one origin. `server/start.js` validates configuration, applies every pending SQL migration, and only then starts listening.

## Local machine as a LAN server

The application can run on a development computer and be shared with devices on the same local network. This does not require GitHub Pages: open the Node.js service directly so the browser and `/api/v1` endpoints use the same origin.

Find the computer's LAN address with `hostname -I`, then add the following to the ignored local `.env` file. Replace `<LAN-IP>` with the actual address. On the current example machine, it is `192.168.14.234`:

```env
HOST=0.0.0.0
PORT=3000
SECURE_COOKIES=false
APP_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://<LAN-IP>:3000
```

Start the database and application:

```bash
docker compose up -d postgres
npm run dev
```

Open `http://<LAN-IP>:3000/` from another device on the same network. Verify readiness from the host with `curl http://<LAN-IP>:3000/health`; an HTTP 200 response means the API is reachable. If the host firewall is enabled, allow TCP port 3000 only from the local subnet, for example:

```bash
sudo ufw allow from 192.168.14.0/24 to any port 3000 proto tcp
```

Use the actual subnet instead of the example above. Do not expose PostgreSQL port 5432; the local Compose file binds it to `127.0.0.1`. The host and client device must be on the same non-guest network, and wireless client isolation must be disabled. Local HTTP is suitable for LAN testing; use HTTPS and `SECURE_COOKIES=true` before exposing the service beyond the trusted network.

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
