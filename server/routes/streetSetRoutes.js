const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const streetSets = require('../db/streetSets');
const router = express.Router();
const { validate } = require('../middleware/validate');
const { createStreetSetSchema, updateStreetSetSchema } = require('./schema');

router.use(authenticateToken);

// Non-numeric ids (old ObjectIds, typos) are a 404, not a Postgres cast error
router.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) {
    return res.status(404).json({ message: 'Street set not found' });
  }
  next();
});

const notFound = (res) => res.status(404).json({ message: 'Street set not found' });
const serverError = (res, label, err) => {
  res.req.log.error({ err }, label);
  res.status(500).json({ message: 'Server error' });
};

router.get('/', async (req, res) => {
  try {
    res.json(await streetSets.listStreetSets(req.user.userId));
  } catch (err) {
    serverError(res, 'List street sets', err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const set = await streetSets.getStreetSet(req.user.userId, req.params.id);
    return set ? res.json(set) : notFound(res);
  } catch (err) {
    serverError(res, 'Get street set', err);
  }
});


router.post('/', validate(createStreetSetSchema), async (req, res) => {
  try {
    res.status(201).json(await streetSets.createStreetSet(req.user.userId, req.body));
  } catch (err) {
    serverError(res, 'Create street set', err);
  }
});

router.put('/:id', validate(updateStreetSetSchema), async (req, res) => {
  try {
    const set = await streetSets.updateStreetSet(req.user.userId, req.params.id, req.body);
    return set ? res.json(set) : notFound(res);
  } catch (err) {
    serverError(res, 'Update street set', err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await streetSets.deleteStreetSet(req.user.userId, req.params.id);
    return deleted ? res.json({ message: 'Street set deleted successfully' }) : notFound(res);
  } catch (err) {
    serverError(res, 'Delete street set', err);
  }
});

module.exports = router;