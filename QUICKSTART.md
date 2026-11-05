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
├── server.js                       Express app, security middleware, startup checks
├── routes/                         auth, street sets
├── middleware/auth.js              JWT check shared by both route files
└── db/
    ├── pool.js                     shared pg Pool and transaction helper
    ├── streetSets.js               street-set SQL and row-to-API mapping
    └── migrations/                 versioned schema (node-pg-migrate, plain SQL)
```