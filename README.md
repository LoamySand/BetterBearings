# BetterBearings

Finally, a learning experience for the directionally challenged.

BetterBearings is a street-learning game built on the PERN stack (PostgreSQL, Express, React, Node). You're shown a street name and click that street on the map. Play a random area without an account, or sign up to save street sets for the neighborhoods you want to learn.

[![CI](https://github.com/LoamySand/BetterBearings/actions/workflows/ci.yml/badge.svg?branch=Apple)](https://github.com/LoamySand/BetterBearings/actions/workflows/ci.yml?query=branch%3AApple)
![Node 24](https://img.shields.io/badge/node-24-339933)
![PostgreSQL 17 + PostGIS](https://img.shields.io/badge/PostgreSQL_17-PostGIS_3.5-336791)

## Features

- Click-the-street gameplay on a Leaflet map, with score and round tracking
- Random areas for guests, using live OpenStreetMap data
- Accounts with saved street sets of up to 200 streets each

## Tech stack

| Layer        | Tools                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Client       | React 19, Vite, React Router, Leaflet with OpenStreetMap tiles                                                        |
| Server       | Node 24, Express 5, zod validation, pino logging, helmet (strict CSP), express-rate-limit                             |
| Database     | PostgreSQL 17 + PostGIS 3.5 through node-postgres, with parameterized SQL and no ORM; migrations with node-pg-migrate |
| Tests and CI | node:test and supertest against a PostGIS service container in GitHub Actions                                         |

## How it works

- **Street data** comes from the Overpass API and is fetched in the browser, so the server never handles map queries.
- **Street sets** are stored as `geometry(MultiLineString, 4326)`, one row per street. The client works in `[lat, lng]` and PostGIS stores `[lng, lat]`; the data layer swaps both directions, and a test checks the stored order directly in PostGIS.
- **Request limits come from measured data.** A dense 200-street set is about 313 KB, so street-set bodies are capped at 1.5 MB, and every other endpoint at 10 KB.
- **Street sets are scoped to their owner.** Another user's set returns 404, not 403, so its existence isn't revealed.
- **Deleting an account** requires the password again and cascades to the user's sets and streets through foreign keys.

## Running locally

See [QUICKSTART.md](QUICKSTART.md) for setup: Node 24, the PostGIS container, environment variables, migrations, and troubleshooting.

Common commands, from the repo root:

| Command                              | What it does                                         |
| ------------------------------------ | ---------------------------------------------------- |
| `npm run dev --prefix server`        | API on port 5000, restarts on change                 |
| `npm start --prefix client`          | Vite dev server on port 3000, proxies `/api`         |
| `npm test --prefix server`           | API tests against the `betterbearings_test` database |
| `npm run migrate up --prefix server` | Apply database migrations                            |
| `npm run lint` / `npm run lint:fix`  | ESLint and Prettier                                  |

## Project layout

```
client/
  src/
    components/    game, modals, header
    contexts/      auth state
    hooks/         Overpass street loading
    pages/         home, street set list and detail
    utils/         Overpass fetcher, area types
server/
  app.js           Express app factory (middleware, routes, error handling)
  server.js        entry point: env checks, database check, listen
  db/              connection pool, street-set queries, SQL migrations
  middleware/      JWT auth, zod validation
  routes/          auth and street-set routes, zod schemas
  test/            API tests
.github/workflows/ CI
```