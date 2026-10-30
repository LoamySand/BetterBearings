
# BetterBearings

Finally, a learning experience for the directionally challenged.

BetterBearings is a MERN-stack geography game that challenges players to locate streets on a map. The game is fast, fun, and focused on improving map knowledge and spatial recall. Click the correct street on the interactive map to score points.

[![CI](https://github.com/LoamySand/BetterBearings/actions/workflows/ci.yml/badge.svg?branch=Apple)](https://github.com/LoamySand/BetterBearings/actions/workflows/ci.yml?query=branch%3AApple)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-yellowgreen)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Top Language](https://img.shields.io/github/languages/top/LoamySand/BetterBearings)](https://github.com/LoamySand/BetterBearings)

## Features

- Interactive map-based gameplay (click the street displayed)
- Multiple city selection for rounds
- Score and round tracking
- Responsive UI for desktop and mobile
- Backend service provides city/street datasets and game logic
- Create custom study sets 


## Demo & Screenshots

Live demo: [DEMO_URL]()

Screenshot
![App screenshot](docs/screenshot.png)

---


## Tech Stack
Framework overview
- Frontend: React, JavaScript, CSS, HTML
- Backend: Node.js + Express
- Database: MongoDB
- ORM: Mongoose 
- Maps: Leaflet + OpenStreetMap tiles
- Package manager: npm
--- 
Architecture overview

- /server — Express API, authentication, game endpoints, data seeding
- /client — React frontend (or other framework), Leaflet map, UI components
- MongoDB — stores cities, streets, user details



## Roadmap

- This project roadmap is organized into phases with concrete features and measurable milestones. The initial plan you've provided is incorporated and expanded with suggested sub-tasks and acceptance criteria.

Phase 1 — Expand city coverage 
- Add several additional cities beyond the initial seed set (example: 10–20 regional/capital cities).
- Tasks:
  - Create/import city datasets (GeoJSON or street-line data) for each target city.
  - Seed database with city and street metadata.
  - Verify game rounds work for newly added cities.
- Acceptance criteria:
  - Player can select any newly added city and play a full round without errors.
  - Streets display and are clickable, scoring is recorded correctly.

Phase 2 — All U.S. cities (medium term)
- Expand dataset to cover every incorporated city in the United States (or a curated set).
- Tasks:
  - Source or generate comprehensive street datasets (note: consider licensing & tile usage).
  - Implement batching and efficient storage/indexing in MongoDB (e.g., spatial indexes).
  - Add server endpoints for paginated city listing and cities-by-region queries.
- Acceptance criteria:
  - The app supports selecting from a large list of cities with acceptable performance.
  - Gameplay remains responsive, map rendering and street interactions scale.

Phase 3 — Challenge modes & social features (long term)
- Add multiple challenge modes and leaderboards to increase replayability:
  - Time Trials — players score as many correct streets as possible within a time limit.
    - UI: timer, dynamic scoring based on speed.
    - Backend: optional session-based scoring, persistent leaderboards.
  - Competition Mode — turn-based or synchronous multiplayer challenges.
    - Options: head-to-head, tournament bracket, or asynchronous challenges.
    - Backend: match-making, real-time updates (WebSocket/Socket.io) or polling.
  - Leaderboards — global and city-specific high-score tables.
    - Backend: store scores, protect against cheating (rate limits, verification).
- Tasks:
  - Design UI/UX for each mode.
  - Implement server-side game session handling and persistence.
  - Add leaderboard endpoints with pagination and security checks.
- Acceptance criteria:
  - Each challenge mode is playable end-to-end and scores persist to the leaderboard.
  - Leaderboards display correct rankings and can be filtered by city/mode.

Phase 4 — Polishing & growth (optional)
- Accessibility improvements, mobile optimizations.
- Analytics (privacy-first) to track engagement, then use metrics to guide city additions and difficulty tuning.


---

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature`
3. Write code
4. Lint and format: `npm run lint && npm run format`
5. Open a pull request describing your changes

Consider adding a CONTRIBUTING.md to capture PR guidelines, review expectations, and code-of-conduct.

---
## Developer Instructions

Prerequisites
- Node.js >= 16 
- npm

1. Clone the repo
```bash
git clone https://github.com/LoamySand/BetterBearings.git
cd BetterBearings
```

2. Install dependencies (root uses separate client/server folders)
```bash
# from repo root
npm install

# from backend
cd server
npm install
# from frontend
cd ../client
npm install
```

3. Run locally (two terminals)  
Start the backend:
```bash
cd server
npm run dev  
```
Start the frontend:
```bash
cd client
npm start     
```
---
Project structure
```
/
server
    ├─ data/                # test data
    ├─ models/              # MongoDB schemas
    ├─ routers/             # navigation
    ├─ services/            # utility handlers
    ├─ uploads/             # geojson backups, excluded from repository
client
    ├─ src/                 # application source (JS, CSS, assets)
    ├─ public/              # static files
        ├─ components/      # React components
        ├─ data/            # test data
        ├─ hooks/           # React hooks
        ├─ services/        # utility handlers
    ├─ package.json
└─ README.md
```

Common developer commands:
- Fix linting issues: `npm run lint: fix `
- format: `npm run format`




