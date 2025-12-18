const express = require('express');
const router = express.Router();
const StreetSet = require('../models/StreetSet');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  console.log('Auth middleware called');
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token found');
    return res.status(401).json({ message: 'Access token required' });
  }

  console.log('Token found, verifying...');
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification error:', err);
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    console.log('Token verified, user:', user);
    req.user = user;
    next();
  });
};

// Get all street sets for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const streetSets = await StreetSet.find({ userId: req.user.userId })
      .select('-streets') // Exclude streets array for list view
      .sort({ updatedAt: -1 });
    
    res.json(streetSets);
  } catch (error) {
    console.error('Error fetching street sets:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single street set by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const streetSet = await StreetSet.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!streetSet) {
      return res.status(404).json({ message: 'Street set not found' });
    }

    res.json(streetSet);
  } catch (error) {
    console.error('Error fetching street set:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new street set
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, center, radius, streets } = req.body;

    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    console.log('Streets type:', typeof streets);
    console.log('Streets is array:', Array.isArray(streets));
    console.log('First street:', streets?.[0]);

    if (!name || !center || !radius || !streets) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const streetSet = new StreetSet({
      userId: req.user.userId,
      name,
      description,
      center,
      radius,
      streets,
    });

    await streetSet.save();
    res.status(201).json(streetSet);
  } catch (error) {
    console.error('Error creating street set:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a street set
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, streets } = req.body;

    const streetSet = await StreetSet.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!streetSet) {
      return res.status(404).json({ message: 'Street set not found' });
    }

    if (name) streetSet.name = name;
    if (description !== undefined) streetSet.description = description;
    if (streets) streetSet.streets = streets;

    await streetSet.save();
    res.json(streetSet);
  } catch (error) {
    console.error('Error updating street set:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle a street's included status
router.patch('/:id/streets/:streetIndex', authenticateToken, async (req, res) => {
  try {
    const { id, streetIndex } = req.params;
    const { included } = req.body;

    const streetSet = await StreetSet.findOne({
      _id: id,
      userId: req.user.userId,
    });

    if (!streetSet) {
      return res.status(404).json({ message: 'Street set not found' });
    }

    if (streetIndex >= streetSet.streets.length) {
      return res.status(400).json({ message: 'Invalid street index' });
    }

    streetSet.streets[streetIndex].included = included;
    await streetSet.save();

    res.json(streetSet);
  } catch (error) {
    console.error('Error toggling street:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a street set
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const streetSet = await StreetSet.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!streetSet) {
      return res.status(404).json({ message: 'Street set not found' });
    }

    res.json({ message: 'Street set deleted successfully' });
  } catch (error) {
    console.error('Error deleting street set:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
