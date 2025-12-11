const express = require('express');
const router = express.Router();
const Street = require('../models/Street');
const streetDataService = require('../services/streetDataService');

console.log('✅ Street routes loaded');
// Test route to verify routing works
router.get('/test', (req, res) => {
  res.json({ message: 'Street routes are working!' });
});

// Get all streets from database
router.get('/', async (req, res) => {
  try {
    const streets = await Street.find();
    res.json(streets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get random streets for game
router.get('/random/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 5;
    const difficulty = req.query.difficulty; // Optional: filter by difficulty
    
    let query = {};
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    const streets = await Street.aggregate([
      { $match: query },
      { $sample: { size: count } }
    ]);
    
    res.json(streets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch fresh streets from OSM and save to database
router.post('/fetch', async (req, res) => {
  try {
    console.log('Fetching streets from OpenStreetMap...');
    const count = req.body.count || 20;
    const streets = await streetDataService.fetchRandomStreets(count);
    
    if (streets.length === 0) {
      return res.status(404).json({ 
        message: 'No streets found. Check your Overpass API connection.' 
      });
    }
    
    // Save to database
    const savedStreets = [];
    const skippedStreets = [];
    
    for (const streetData of streets) {
      try {
        // Check if street already exists
        const existing = await Street.findOne({ osmId: streetData.id });
        
        if (!existing) {
          const street = new Street({
            osmId: streetData.id,
            name: streetData.name,
            coordinates: streetData.coordinates,
            difficulty: streetData.difficulty,
            type: streetData.type,
            length: streetData.length,
            source: streetData.source,
          });
          
          const saved = await street.save();
          savedStreets.push(saved);
        } else {
          skippedStreets.push(streetData.name);
        }
      } catch (err) {
        console.error(`Error saving street ${streetData.name}:`, err.message);
      }
    }
    
    res.json({
      message: `Fetched ${streets.length} streets from OSM`,
      saved: savedStreets.length,
      skipped: skippedStreets.length,
      streets: savedStreets,
      skippedStreets: skippedStreets,
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error fetching streets from OSM',
      error: err.message 
    });
  }
});

// Fetch streets by difficulty
router.post('/fetch/:difficulty', async (req, res) => {
  try {
    const difficulty = req.params.difficulty;
    const count = req.body.count || 10;
    
    console.log(`Fetching ${difficulty} difficulty streets...`);
    const streets = await streetDataService.fetchStreetsByDifficulty(difficulty, count);
    
    // Save to database
    const savedStreets = [];
    for (const streetData of streets) {
      const existing = await Street.findOne({ osmId: streetData.id });
      
      if (!existing) {
        const street = new Street({
          osmId: streetData.id,
          name: streetData.name,
          coordinates: streetData.coordinates,
          difficulty: streetData.difficulty,
          type: streetData.type,
          length: streetData.length,
          source: streetData.source,
        });
        
        const saved = await street.save();
        savedStreets.push(saved);
      }
    }
    
    res.json({
      message: `Fetched ${savedStreets.length} ${difficulty} streets`,
      streets: savedStreets,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search for a specific street
router.get('/search/:name', async (req, res) => {
  try {
    // First check database
    const dbStreets = await Street.find({ 
      name: new RegExp(req.params.name, 'i') 
    });
    
    if (dbStreets.length > 0) {
      return res.json({ source: 'database', streets: dbStreets });
    }
    
    // If not in database, search OSM
    const osmStreets = await streetDataService.searchStreet(req.params.name);
    res.json({ source: 'osm', streets: osmStreets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get street count by difficulty
router.get('/stats/difficulty', async (req, res) => {
  try {
    const stats = await Street.aggregate([
      {
        $group: {
          _id: '$difficulty',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update street statistics after game
router.patch('/:id/stats', async (req, res) => {
  try {
    const { correct } = req.body;
    
    const street = await Street.findById(req.params.id);
    if (!street) {
      return res.status(404).json({ message: 'Street not found' });
    }
    
    street.timesPlayed += 1;
    if (correct) {
      street.timesCorrect += 1;
    }
    
    await street.save();
    res.json(street);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete all streets (for testing)
router.delete('/all', async (req, res) => {
  try {
    const result = await Street.deleteMany({});
    res.json({ 
      message: 'All streets deleted',
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;