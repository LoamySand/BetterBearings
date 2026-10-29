# Quick Start

BetterBearings (formerly BackOfYourHand) is a street-learning game: you're shown a street name and click it on the map. Street data comes from OpenStreetMap's Overpass API, fetched in the browser. Accounts, scores and saved street sets live in the database.

> **Temporary setup.** This guide covers the MongoDB version. Sprint 1 moves the database to Postgres; this file will be rewritten then.

## Prerequisites

- **Node.js 24 LTS** (`node -v`). Using nvm: `nvm install 24 && nvm use 24`
- **Podman or Docker** to run the database container. On Fedora, Podman is preinstalled; substitute `docker` for `podman` below if you use Docker.
- **Git**

## Setup

```bash
git clone https://github.com/LoamySand/BackOfYourHand.git
cd BetterBearings
npm install && npm install --prefix server && npm install --prefix client
```

### Database

```bash
podman run -d --name bb-mongo -p 27017:27017 docker.io/library/mongo:7
```

Later sessions only need `podman start bb-mongo`.

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
| `JWT_SECRET` | Yes | none | Signs login tokens. Street-set routes fail without it. |
| `MONGO_URI` | No | `mongodb://localhost:27017/mern-startup` | Use `127.0.0.1`, not `localhost` (see Troubleshooting) |
| `PORT` | No | `5000` | API port |
| `CLIENT_URL` | No | none | Extra allowed CORS origin |

The client needs no `.env` in development; it calls `http://localhost:5000/api`.

## Run

Two terminals, from the repo root:

```bash
npm run dev --prefix server   # API on http://localhost:5000 (auto-restarts on change)
npm start --prefix client     # app on http://localhost:3000
```

The server is ready when it prints `MongoDB Connected`.

## Smoke test

Run this after setup or any large change:

1. Play a round logged out (random street mode).
2. Sign up for an account.
3. Create a street set. Keep the radius at 1 to 2 km while testing; 5 km queries are slow.
4. Refresh the street-set page; the set should still be there.
5. Play a round from the saved set and confirm the score updates.

## Production build

```bash
npm run build --prefix client
NODE_ENV=production PORT=5000 node server/server.js
```

The server then serves the built app at http://localhost:5000. Use this build for Lighthouse audits; the dev server scores poorly on performance for reasons that don't apply in production.

## Troubleshooting

**`MongooseServerSelectionError: read ECONNRESET` or `ECONNREFUSED`**
- Check the container is up: `podman ps -a`. If it exited, `podman logs bb-mongo` says why.
- Wait about 10 seconds after starting the container, then restart the server.
- Use `127.0.0.1` in `MONGO_URI`. Node resolves `localhost` to IPv6 (`::1`) first, and rootless Podman only forwards the port on IPv4.
- Mongo 5.0+ needs a CPU with AVX. If `grep -c avx /proc/cpuinfo` prints `0`, use `mongo:4.4`.

**`docker: command not found`**
- On Fedora use `podman`, or `sudo dnf install podman-docker` for a `docker` alias.

**Overpass errors (502, 504, 429) or timeouts**
- The public Overpass servers are volunteer-run and overload regularly. The app tries each server in `client/src/utils/overpassFetcher.js` before failing.
- Check load: `curl -s https://overpass-api.de/api/status`. `0 slots available` means wait.
- Reduce the radius.

**Stale street data**
- Responses are cached in the browser. In DevTools, open Application (Storage in Firefox), then Local Storage, and delete keys starting with `overpass-response`.

**Login works but street sets fail with 401 or 403**
- `JWT_SECRET` is missing from `server/.env`.

## Project layout

```
client/src/
├── components/Game.jsx   main game
├── components/QuizAreaModule.jsx   area picker for the game
├── pages/StreetSets.jsx            saved street sets
├── pages/StreetSetDetail.jsx       one street set
├── contexts/AuthContext.js         login state
├── hooks/useOverpassStreets.js     loads streets for an area
└── utils/                          Overpass query, fetch, street processing
server/
├── server.js                       Express app, security middleware
├── routes/                         auth, scores, street sets
└── models/                         User, Score, StreetSet
```