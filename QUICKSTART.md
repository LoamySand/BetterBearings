# Quick Start

BetterBearings is a street-learning game: you're shown a street name and click it on the map. Street data is our own import of an OpenStreetMap extract into PostGIS, served by `/api/streets`, and the map is self-hosted vector tiles with street labels removed. Accounts and saved street sets live in PostgreSQL with PostGIS.

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
| `RESEND_API_KEY` | Production only | none | Sends password reset emails through Resend. Unset in development: the email, with its link, is logged instead. The server exits in production without it. |
| `APP_URL` | Production only | `http://localhost:3000` | Base of the link in reset emails, as `https://host` with no trailing slash. The server exits in production without it. |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | No | `BetterBearings <noreply@betterbearings.net>`, `contact@betterbearings.net` | Sender and reply address of reset emails |

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

1. Play a game logged out (Quiz this area).
2. Sign up for an account. Log out, then log back in with the email in different capitalization.
3. Create a street set.
4. Refresh the street-set page; the set should still be there.
5. Play a round from the saved set and confirm the score updates.
6. Turn a few streets off, save, and check that the counts on the list page change.
7. Delete the set.

## Production build

```bash
npm run build --prefix client
NODE_ENV=production CORS_ORIGINS=http://localhost:5000 node server/server.js
```

Production mode also needs `RESEND_API_KEY` and an `https://` `APP_URL` in `server/.env`, or the server exits at startup. Locally, placeholders do: `RESEND_API_KEY=re_local_dummy` and `APP_URL=https://localhost:5000`. A reset request then fails at Resend and logs the error, while the dialog still shows the usual reply.

The server then serves the built app at http://localhost:5000. Stop the Vite dev server first. Use this build for Lighthouse audits; the dev server scores poorly on performance for reasons that don't apply in production.

Production allows 10 failed login, signup, password-reset or delete-account attempts per 15 minutes, counted together. Restarting the server resets the count.

### Lighthouse

Use the CLI in headless Chrome. DevTools Lighthouse in a window gave `NO_FCP` errors, and on Nov 7 it scored prod performance at 63 against the CLI's 84, so the two aren't comparable. Run 3 times and compare medians: on Nov 8 three prod runs scored 94, 100 and 99 on performance. Mobile is the default form factor.

```bash
URL=https://betterbearings.net/   # or http://localhost:5000/ for the production build above
for i in 1 2 3; do
  npx -y lighthouse "$URL" --quiet --chrome-flags="--headless=new" \
    --only-categories=performance,accessibility,best-practices \
    --output=json --output-path=/tmp/lh$i.json
done
for i in 1 2 3; do jq -r '[.categories[].score*100|round]|@tsv' /tmp/lh$i.json; done   # performance, accessibility, best practices
```

Checks on each report:

```bash
for i in 1 2 3; do
  echo "run $i: console=$(jq -r '.audits["errors-in-console"].score' /tmp/lh$i.json)" \
    "own-uncached=$(jq -r '[.audits["uses-long-cache-ttl"].details.items[]?.url | select(test("//betterbearings\\.net"))] | length' /tmp/lh$i.json)" \
    "failing=$(jq -r '[.audits | to_entries[] | select(.value.score == 0) | .key] | join(",")' /tmp/lh$i.json)"
done
```

Expect `console=1` and `own-uncached=0`; `failing` lists the audits that scored 0.

Limits:

- The CLI can't log in, and Lighthouse reloads the page, so every report measures `/` as a logged-out visitor sees it. For the quiz panel with saved sets, My Street Sets and a set's detail page, log in and run DevTools Lighthouse with only Accessibility checked. Accessibility doesn't depend on throttling, so those scores compare with the CLI; performance scores don't.
- If Chrome isn't found, set `CHROME_PATH` to its binary.

## Production (the ProDesk)

Production and staging run the same `deploy/compose.yml`, each from its own directory with its own `.env`:

| Environment | Directory | Compose project | App port | Deployed from |
| --- | --- | --- | --- | --- |
| Production | `/srv/betterbearings/prod` | `betterbearings` | `127.0.0.1:5000` | `main` |
| Staging | `/srv/betterbearings/staging` | `betterbearings-staging` | `127.0.0.1:5001` | other branches in `ci.yml` |

`.env` is mode 600 and owned by `loamy`. Start from `deploy/.env.example`; each environment needs its own `POSTGRES_PASSWORD`, `JWT_SECRET`, `TUNNEL_TOKEN` and `APP_URL`, and a `RESEND_API_KEY`. Compose refuses to start without the last two.

### Password reset email

Reset emails go out through [Resend](https://resend.com) from `noreply@betterbearings.net` (free plan: 3,000 a month, 100 a day). The domain is verified in Resend with a DKIM record at `resend._domainkey` and an MX and SPF record on the `send` subdomain, so Cloudflare Email Routing (`contact@`) keeps the root MX and SPF. A `_dmarc` record (`v=DMARC1; p=none`) sits beside them.

A link works once, for 30 minutes, and is stored only as a SHA-256 hash. It carries the token in the URL fragment (`/reset-password#token=...`), so it never reaches the server's request logs. A successful reset signs out every device: the auth check rejects tokens issued before `users.password_changed_at`. One email per address every 2 minutes; `/api/auth/forgot` allows 5 requests per 15 minutes per IP in production.

To check sending on a host: `docker compose logs app | grep 'Password reset email'` shows `sent` or `failed` for each request, without the address.

### Deploys

CI deploys on every push: it pushes the image as `sha-<7>`, then runs `/srv/betterbearings/bin/deploy.sh <env> sha-<7>` over SSH. The script writes `IMAGE_TAG` into `.env`, runs `docker compose up -d`, waits up to 120 s for the app to be healthy, and rolls back to the previous tag if it isn't. To deploy or roll back by hand, on the ProDesk:

```bash
/srv/betterbearings/bin/deploy.sh prod sha-abc1234
```

CI ships only the image. Each environment's `compose.yml` and `.env` live on the ProDesk and change only by hand, so a commit that changes `deploy/compose.yml` or adds a required variable needs both copied over before it's pushed (staging) or merged to `main` (production). Otherwise the deploy fails its health check and rolls back. From the laptop:

```bash
scp deploy/compose.yml loamy@loamy-prod:/srv/betterbearings/staging/compose.yml
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

### Street data rebuild

Street data (`osm.streets`) comes from the Geofabrik New Mexico extract and is rebuilt weekly by `betterbearings-osm@prod.timer` (Sundays 02:30), which runs `/srv/betterbearings/bin/osm-rebuild.sh prod`. The job builds `osm.streets_import` next to the live table and swaps it in one transaction, so the app keeps serving. It reports to Uptime Kuma: `up` after a swap, `down` on a failure, and the push monitor alerts after 8 days of silence. Staging and prod share the schedule; a lock runs them one after the other.

Heartbeat URLs live in `/srv/betterbearings/<env>/monitor.env` (`BACKUP_PUSH_URL`, `OFFSITE_PUSH_URL`, `OSM_PUSH_URL`). Use `http://127.0.0.1:3001/api/push/<token>`, plain http, with no query string. The URL Kuma shows uses its Primary Base URL, the Tailscale proxy, which scripts on the host can't verify. Test one without running the job:

```bash
set -a; . /srv/betterbearings/prod/monitor.env; set +a
curl -fsS -m 10 -o /dev/null -G --data-urlencode status=up --data-urlencode msg=manual-test "$OSM_PUSH_URL" && echo sent
```

The job refuses to swap when the new import has under 90% of the current rows, which is what a cut-off download looks like. `osm.streets` is left unchanged and the run reports `down`. If the drop is intended (a `streets.lua` change, say), run it once by hand with the check off:

```bash
/srv/betterbearings/bin/osm-rebuild.sh prod -e OSM_FORCE_SWAP=1
```

Past runs, newest first:

```bash
cd /srv/betterbearings/prod
docker compose exec -T db psql -U bb -d betterbearings -c "SELECT finished_at, data_timestamp, row_count, pg_size_pretty(total_bytes) AS size, seconds FROM osm.import_log ORDER BY id DESC LIMIT 5"
```

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

The dump has no street data (`--exclude-schema=osm`), so `/api/streets` returns 503 and games fail until the street data is rebuilt. Run it right after the restore:

```bash
/srv/betterbearings/bin/osm-rebuild.sh prod
```

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

Cloudflare caches one copy of each tile for every visitor, so the CORS header must be the same for all of them. A Response Header Transform Rule sets it at the edge, including on cache hits: **Rules, Transform Rules, Modify Response Header**, same hostname match, set static `Access-Control-Allow-Origin` to `*`.

The site uses the tiles when `TILE_URL` in the environment's `.env` points at them (see `deploy/.env.example`). After changing it, run `docker compose up -d app`; `restart` doesn't reread `.env`.

Check a tile (the second request should say `HIT`):

```bash
curl -sI https://tiles.betterbearings.net/nm/15/6676/12969.mvt | grep -iE '^HTTP|cf-cache-status|content-type|access-control-allow-origin'
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

**"Street data isn't ready" (503 from `/api/streets`)**
- `osm.streets` doesn't exist in that database: the street import hasn't run there, or a backup was just restored (dumps leave street data out). On the ProDesk, run the rebuild (see Street data rebuild).

**"No street data here"**
- The circle is outside the imported extract, which is New Mexico only.

**"No streets for this level here"**
- The circle has streets, but fewer than 2 at this level. Pick a harder level or zoom out.

## Project layout

See [Project layout](README.md#project-layout) in the README.
