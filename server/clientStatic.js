// Serves the built client in production (KAN-71).
// Vite names everything in dist/assets after its content hash, so a new build gets new names and
// those files can be cached for a year. index.html names the current hashes, so it must be
// revalidated on every load, or a deploy wouldn't reach returning players.
const path = require('path');
const express = require('express');

function serveClient(app, buildPath) {
  const indexHtml = path.join(buildPath, 'index.html');

  app.use(
    '/assets',
    express.static(path.join(buildPath, 'assets'), { immutable: true, maxAge: '1y', index: false })
  );
  // A missing asset (an old hash after a deploy) is a plain 404. Without this, the SPA fallback
  // would answer a .js request with index.html. (serve-static's fallthrough: false would instead
  // raise an error that app.js's error handler turns into a 500.)
  app.use('/assets', (req, res) => res.status(404).end());

  // Unhashed files (favicon, robots.txt) keep Express's default: cache, but revalidate.
  // index: false so "/" reaches the fallback below and gets no-cache like every other route.
  app.use(express.static(buildPath, { index: false }));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

module.exports = { serveClient };
