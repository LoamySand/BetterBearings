const express = require('express');
const streets = require('../db/streets');
const { validate } = require('../middleware/validate');
const { streetsQuerySchema } = require('./schema');
const router = express.Router();

// Public: logged-out games use it. Covered by the /api limiter in app.js.
router.get('/', validate(streetsQuerySchema, 'query'), async (req, res) => {
  try {
    res.json({ streets: await streets.pickStreets(req.validatedQuery) });
  } catch (err) {
    // 42P01: osm.streets missing, i.e. osm-import hasn't run in this environment yet
    if (err.code === '42P01') {
      req.log.error({ err }, 'osm.streets missing; run osm-import');
      return res.status(503).json({ message: 'Street data is not available yet' });
    }
    req.log.error({ err }, 'Pick streets');
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
