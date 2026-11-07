# Quick Start

BetterBearings is a street-learning game: you're shown a street name and click it on the map. Street data comes from OpenStreetMap's Overpass API, fetched in the browser. Accounts and saved street sets live in PostgreSQL with PostGIS.

## Prerequisites

- **Node.js 24 LTS** (`node -v`). Using nvm: `nvm install 24 && nvm use 24`
- **Podman or Docker** to run the database container. On Fedora, Podman is preinstalled; substitute `docker` for `podman` below if you use Docker.
- **Git**
- **psql** (optional) for poking at the database: `sudo dnf install postgresql` installs the client only.

## Setup

```bash
git clone https://github.com/LoamySand/BetterBearings.git
cd BetterBearings
npm install && npm install --prefix server && npm install --prefix client
```

### Environment

```bash
cp server/.env.example server/.env
```

Then set `JWT_SECRET` in `server/.env`:

```bash
openssl rand -hex 32
```

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes | none | Signs login tokens. The server exits at startup without it. |
| `DATABASE_URL` | Yes | none | Postgres connection string. The example value matches the container below. Use `127.0.0.1`, not `localhost` (see Troubleshooting). |
| `CORS_ORIGINS` | Production only | `http://localhost:3000` | Comma-separated allowed origins. The server exits in production without it. |
| `PORT` | No | `5000` | API port |

The client needs no `.env`. In development, Vite proxies `/api` to the server on port 5000.

### Database

```bash
podman volume create bb-pgdata
podman run -d --name bb-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=bb \
  -e POSTGRES_PASSWORD=bb_dev \
  -e POSTGRES_DB=betterbearings \
  -v bb-pgdata:/var/lib/postgresql/data \
  docker.io/postgis/postgis:17-3.5
```

Create the tables:

```bash
npm run migrate up --prefix server
```

Later sessions only need `podman start bb-postgres`. Data survives container restarts because it lives in the `bb-pgdata` volume.

To start over with an empty database:

```bash
podman rm -f bb-postgres && podman volume rm bb-pgdata
```

Then repeat this section.

### Schema changes

Migrations are plain SQL files in `server/db/migrations`, applied in filename order. `node-pg-migrate` records applied files in the `pgmigrations` table, so `migrate up` only runs new ones.

```bash
npm run migrate:create --prefix server -- add-something   # new file in server/db/migrations
npm run migrate up --prefix server
npm run migrate down --prefix server                      # rolls back the latest one
```

Never edit a migration that has been pushed and run anywhere else. Add a new one instead.

## Run

Two terminals, from the repo root:

```bash
npm run dev --prefix server   # API on http://localhost:5000 (auto-restarts on change)
npm start --prefix client     # app on http://localhost:3000
```

The server checks the database connection before listening. It's ready when it prints `Server running on port 5000`.

## Smoke test

Run this after setup or any large change:

1. Play a round logged out (random street mode).
2. Sign up for an account. Log out, then log back in with the email in different capitalization.
3. Create a street set. Keep the radius at 1 to 2 km while testing; 5 km queries are slow.
4. Refresh the street-set page; the set should still be there.
5. Play a round from the saved set and confirm the score updates.
6. Turn a few streets off, save, and check that the counts on the list page change.
7. Delete the set.

## Production build

```bash
npm run build --prefix client
NODE_ENV=production CORS_ORIGINS=http://localhost:5000 node server/server.js
```

The server then serves the built app at http://localhost:5000. Stop the Vite dev server first. Use this build for Lighthouse audits; the dev server scores poorly on performance for reasons that don't apply in production.

Production allows 5 login or signup attempts per 15 minutes. Restarting the server resets the count.

## Production (the ProDesk)

Production and staging run the same `deploy/compose.yml`, each from its own directory with its own `.env`:

| Environment | Directory | Compose project | App port | Deployed from |
| --- | --- | --- | --- | --- |
| Production | `/srv/betterbearings/prod` | `betterbearings` | `127.0.0.1:5000` | `main` |
| Staging | `/srv/betterbearings/staging` | `betterbearings-staging` | `127.0.0.1:5001` | other branches in `ci.yml` |

`.env` is mode 600 and owned by `loamy`. Start from `deploy/.env.example`; each environment needs its own `POSTGRES_PASSWORD`, `JWT_SECRET` and `TUNNEL_TOKEN`.

### Deploys

CI deploys on every push: it pushes the image as `sha-<7>`, then runs `/srv/betterbearings/bin/deploy.sh <env> sha-<7>` over SSH. The script writes `IMAGE_TAG` into `.env`, runs `docker compose up -d`, waits up to 120 s for the app to be healthy, and rolls back to the previous tag if it isn't. To deploy or roll back by hand, on the ProDesk:

```bash
/srv/betterbearings/bin/deploy.sh prod sha-abc1234
```

### Migrations

The `migrate` service runs `npm run migrate -- up` from the same image before `app` starts, and `app` only starts if it exits 0. Check it with:

```bash
cd /srv/betterbearings/prod
docker compose logs migrate
```

A rollback doesn't undo a migration that already ran, so keep migrations backward compatible with the previous release.

### Status

```bash
cd /srv/betterbearings/prod
docker compose ps
curl -s 127.0.0.1:5000/healthz
docker compose logs app --tail 50
```

### Backups

`betterbearings-backup@prod.timer` dumps nightly at 03:20 to `/srv/backups/betterbearings/prod/` and keeps 14 days. `betterbearings-offsite@prod.timer` encrypts the newest dump with age and copies it to Google Drive on Sundays at 04:40, keeping 8. Both report to Uptime Kuma, so a missed run alerts.

Test that the newest dump restores (into a throwaway container, live data untouched):

```bash
/srv/betterbearings/bin/restore-test.sh prod
```

It prints row counts for the dump and the live database and ends with `PASS` when they match.

### Restoring a backup

This replaces the live database. Take a fresh dump first so the current state can be recovered:

```bash
/srv/betterbearings/bin/backup.sh prod
/srv/betterbearings/bin/restore-test.sh prod /srv/backups/betterbearings/prod/<file>.dump   # confirm the dump you want is good
cd /srv/betterbearings/prod
docker compose stop app cloudflared
docker compose exec -T db dropdb -U bb --maintenance-db=postgres --force betterbearings
docker compose exec -T db createdb -U bb --maintenance-db=postgres -T template0 betterbearings
docker compose exec -T db pg_restore -U bb -d betterbearings --no-owner --exit-on-error < /srv/backups/betterbearings/prod/<file>.dump
docker compose up -d
```
Pause the environment's `/healthz` monitor in Uptime Kuma first; the app is down for the restore and will otherwise alert. Unpause it after `docker compose up -d`.

`template0` gives an empty database; the dump recreates PostGIS and every table, the same way `restore-test.sh` does.

To restore from the offsite copy, download and decrypt it on a machine with the private age key, then copy the `.dump` to `/srv/backups/betterbearings/prod/`:

```bash
rclone copy gdrive-backup:BetterBearings-backups/prod/<file>.dump.age .
age -d -i ~/.config/age/betterbearings-backup.key -o <file>.dump <file>.dump.age
```

### Map tiles

The `tiles` service (go-pmtiles) serves every `.pmtiles` file in `/srv/betterbearings/tiles/` as `/<name>/{z}/{x}/{y}.mvt`. Both environments mount the same directory read-only. It has no published port; each environment's tunnel reaches it as `tiles:8080`:

| Environment | Tile hostname | Tunnel |
| --- | --- | --- |
| Production | `tiles.betterbearings.net` | `betterbearings-prod` |
| Staging | `tiles-staging.betterbearings.net` | `betterbearings-staging` |

Staging uses a hyphen, not `tiles.staging.`, because Cloudflare's free certificate covers one subdomain level only.

Build or refresh the New Mexico archive (z15, about 286 MB). Write it under a new name and `mv` it, so the server never reads a half-written file, then restart `tiles` in each environment so it drops its cached directory:

```bash
mkdir -p /srv/betterbearings/tiles
~/bin/pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles /srv/betterbearings/tiles/nm.pmtiles.new --bbox=-109.06,31.33,-103.00,37.00 --maxzoom=15
mv /srv/betterbearings/tiles/nm.pmtiles.new /srv/betterbearings/tiles/nm.pmtiles
cd /srv/betterbearings/prod && docker compose restart tiles
cd /srv/betterbearings/staging && docker compose restart tiles
```

Cloudflare doesn't cache `.mvt` by default, and go-pmtiles sends no `Cache-Control`, so a Cache Rule does it: **Caching, Cache Rules**, hostname is in `tiles.betterbearings.net tiles-staging.betterbearings.net`, **Eligible for cache**, Edge TTL ignore origin 30 days, Browser TTL 1 day. After refreshing the archive, purge the tile hostname's cache (**Caching, Configuration, Custom Purge, Hostname**).

Check a tile (the second request should say `HIT`):

```bash
curl -sI https://tiles.betterbearings.net/nm/15/6676/12969.mvt | grep -iE '^HTTP|cf-cache-status|content-type'
```

## Troubleshooting

**`Postgres connection failed: connect ECONNREFUSED`**
- Check the container is up: `podman ps -a`. If it exited, `podman logs bb-postgres` says why.
- On first start, Postgres takes a few seconds to initialize. Wait, then restart the server.
- Use `127.0.0.1` in `DATABASE_URL`. Node resolves `localhost` to IPv6 (`::1`) first, and rootless Podman only forwards the port on IPv4.

**`password authentication failed for user "bb"`**
- `DATABASE_URL` doesn't match the `POSTGRES_USER` and `POSTGRES_PASSWORD` the container was created with. Those values only apply when the volume is first initialized, so changing them later does nothing. Fix the URL, or reset the database (see Database).

**`relation "users" does not exist`**
- The migrations haven't run: `npm run migrate up --prefix server`.

**`Missing required environment variable: ...`**
- Set that variable in `server/.env`.

**Login works but street sets fail with 401**
- Your saved token is from an older build or was signed with a different `JWT_SECRET`. Log out and back in.

**`docker: command not found`**
- On Fedora use `podman`, or `sudo dnf install podman-docker` for a `docker` alias.

**Overpass errors (502, 504, 429) or timeouts**
- The public Overpass servers are volunteer-run and overload regularly. The app tries each server in `client/src/utils/overpassFetcher.js` before failing.
- Check load: `curl -s https://overpass-api.de/api/status`. `0 slots available` means wait.
- Reduce the radius.

**Stale street data**
- Responses are cached in the browser. In DevTools, open Application (Storage in Firefox), then Local Storage, and delete keys starting with `overpass-response`.

## Project layout

```
client/src/
├── components/Game.jsx             main game
├── components/QuizAreaModule.jsx   area picker for the game
├── pages/StreetSets.jsx            saved street sets
├── pages/StreetSetDetail.jsx       one street set
├── contexts/AuthContext.js         login state
├── hooks/useOverpassStreets.js     loads streets for an area
└── utils/                          Overpass query, fetch, street processing
server/
├── app.js                          Express app: security middleware, routes, error handling
├── server.js                       entry point: env checks, database check, listen
├── routes/                         auth, street sets
├── middleware/auth.js              JWT check shared by both route files
└── db/
    ├── pool.js                     shared pg Pool and transaction helper
    ├── streetSets.js               street-set SQL and row-to-API mapping
    └── migrations/                 versioned schema (node-pg-migrate, plain SQL)
```