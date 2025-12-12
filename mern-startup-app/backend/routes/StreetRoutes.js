const express = require('express');
const router = express.Router();
const Street = require('../models/Street');
const geojsonImportService = require('../services/geojsonImportService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const streetMerger = require('../services/streetMerger');

console.log('✅ Street routes loading...');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});
// Merge existing street segments
router.post('/merge/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    const { maxDistance } = req.body; // in km, default 0.5
    
    console.log(`Merging segments for ${cityName}...`);
    
    // Get all streets for this city
    const streets = await Street.find({ city: cityName }).lean();
    
    if (streets.length === 0) {
      return res.status(404).json({ message: `No streets found for ${cityName}` });
    }
    
    console.log(`Found ${streets.length} segments to merge`);
    
    // Merge them
   // const mergedStreets = streetMerger.mergeStreetSegments(streets, maxDistance || 0.5);
    
   // console.log(`Merged into ${mergedStreets.length} segments`);
    
    // Delete old segments
    await Street.deleteMany({ city: cityName });
    
    // Save merged segments
    const saved = [];
    for (const street of mergedStreets) {
      const newStreet = new Street({
        name: street.name,
        coordinates: street.coordinates,
        difficulty: street.difficulty,
        type: street.type,
        city: street.city,
        state: street.state,
        length: street.coordinates.length,
        source: street.source + '_merged',
        importedAt: new Date()
      });
      
      await newStreet.save();
      saved.push({
        name: newStreet.name,
        coordinateCount: newStreet.coordinates.length
      });
    }
    
    res.json({
      message: `Merged streets for ${cityName}`,
      original: streets.length,
      merged: mergedStreets.length,
      reduction: `${((1 - mergedStreets.length / streets.length) * 100).toFixed(1)}%`,
      streets: saved.slice(0, 20)
    });
    
  } catch (err) {
    console.error('Error merging streets:', err);
    res.status(500).json({ message: err.message });
  }
});
// ===== CITY ROUTES =====

// Get all unique cities in database
router.get('/cities', async (req, res) => {
  try {
    console.log('GET /cities - Fetching all cities...');
    const cities = await Street.distinct('city');
    
    const cityCounts = await Promise.all(
      cities.map(async (city) => ({
        name: city,
        streetCount: await Street.countDocuments({ city })
      }))
    );
    
    console.log(`Found ${cityCounts.length} cities`);
    res.json(cityCounts);
  } catch (err) {
    console.error('Error getting cities:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get stats for a specific city
router.get('/stats/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    console.log(`GET /stats/${cityName}`);
    
    const totalStreets = await Street.countDocuments({ city: cityName });
    
    const uniqueStreets = await Street.aggregate([
      { $match: { city: cityName } },
      { $group: { _id: '$name' } },
      { $count: 'total' }
    ]);
    
    const difficultyStats = await Street.aggregate([
      { $match: { city: cityName } },
      { 
        $group: { 
          _id: { name: '$name', difficulty: '$difficulty' },
          count: { $sum: 1 }
        } 
      },
      {
        $group: {
          _id: '$_id.difficulty',
          streets: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      city: cityName,
      totalSegments: totalStreets,
      uniqueStreets: uniqueStreets[0]?.total || 0,
      byDifficulty: difficultyStats
    });
  } catch (err) {
    console.error('Error getting city stats:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete all streets for a city
router.delete('/city/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    console.log(`DELETE /city/${cityName}`);
    
    const result = await Street.deleteMany({ city: cityName });
    
    res.json({ 
      message: `Deleted all streets for ${cityName}`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Error deleting city:', err);
    res.status(500).json({ message: err.message });
  }
});

// ===== STREET ROUTES =====

// Get all streets (optionally filter by city)
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    console.log(`GET / - city filter: ${city || 'none'}`);
    
    const query = city ? { city } : {};
    const streets = await Street.find(query);
    
    console.log(`Found ${streets.length} streets`);
    res.json(streets);
  } catch (err) {
    console.error('Error getting streets:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get random complete streets (grouped by name) for a specific city
router.get('/random-complete/:count', async (req, res) => {
  try {
    const count = parseInt(req.params.count) || 5;
    const { city, difficulty } = req.query;
    
    const cityName = city || 'Albuquerque';
    
    console.log(`GET /random-complete/${count} - city: ${cityName}, difficulty: ${difficulty || 'any'}`);
    
    let query = { city: cityName };
    if (difficulty) {
      query.difficulty = difficulty;
    }
    
    const allStreets = await Street.find(query);
    console.log(`Found ${allStreets.length} total street segments`);
    
    // Group by street name
    const streetGroups = {};
    allStreets.forEach(street => {
      const name = street.name;
      if (!streetGroups[name]) {
        streetGroups[name] = {
          name: name,
          segments: [],
          difficulty: street.difficulty,
          type: street.type,
          city: street.city,
          source: street.source,
        };
      }
      
      streetGroups[name].segments.push({
        _id: street._id,
        osmId: street.osmId,
        coordinates: street.coordinates,
      });
    });
    console.log(`Grouped into ${Object.keys(streetGroups).length} unique street names`);
    
    // Log first few groups
    Object.keys(streetGroups).slice(0, 3).forEach(name => {
      console.log(`  ${name}: ${streetGroups[name].segments.length} segments`);
    });    
    const completeStreets = Object.values(streetGroups).map((group, index) => ({
      id: `street_group_${cityName}_${index}_${Date.now()}`,
      name: group.name,
      segments: group.segments,
      segmentCount: group.segments.length,
      difficulty: group.difficulty,
      type: group.type,
      city: group.city,
      source: group.source,
    }));
    
    console.log(`Grouped into ${completeStreets.length} unique streets`);
    
    // Shuffle and pick random
    const shuffled = completeStreets.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    console.log(`Returning ${selected.length} streets`);
    res.json(selected);
  } catch (err) {
    console.error('Error getting random streets:', err);
    res.status(500).json({ message: err.message });
  }
});

// ===== IMPORT ROUTES =====

// Test upload route
router.post('/test-upload', upload.single('file'), (req, res) => {
  console.log('\n=== TEST UPLOAD ===');
  console.log('File received:', req.file ? 'Yes' : 'No');
  
  if (req.file) {
    console.log('File details:', {
      name: req.file.originalname,
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB',
      path: req.file.path
    });
    
    // Clean up
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      message: 'File upload works!',
      filename: req.file.originalname,
      size: req.file.size
    });
  } else {
    res.status(400).json({ success: false, message: 'No file received' });
  }
});

// Import from uploaded GeoJSON file
router.post('/import-geojson/:cityName', upload.single('file'), async (req, res) => {
  console.log('\n=== IMPORT GEOJSON ===');
  console.log('City:', req.params.cityName);
  console.log('File uploaded:', req.file ? 'Yes' : 'No');
  
  try {
    const { cityName } = req.params;
    
    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('File details:');
    console.log('  Path:', req.file.path);
    console.log('  Size:', (req.file.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('  Name:', req.file.originalname);
    
    // Check if geojsonImportService exists
    if (!geojsonImportService) {
      console.error('❌ geojsonImportService not found!');
      throw new Error('Import service not available');
    }
    
    console.log('Starting import process...');
    const result = await geojsonImportService.importCity(req.file.path, cityName);
    
    console.log('✅ Import successful!');
    console.log('  Unique streets:', result.saved.length);
    
    // Clean up uploaded file
    console.log('Cleaning up temp file...');
    fs.unlinkSync(req.file.path);
    
    res.json({
      message: `Successfully imported streets for ${cityName}`,
      city: cityName,
      uniqueStreets: result.saved.length,
      totalSegments: result.saved.reduce((sum, s) => sum + s.segments, 0),
      streets: result.saved.slice(0, 20),
      errors: result.errors
    });
    
  } catch (err) {
    console.error('\n=== IMPORT ERROR ===');
    console.error('Error message:', err.message);
    console.error('Stack trace:', err.stack);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        console.log('Cleaning up file after error...');
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      message: 'Error importing GeoJSON',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Delete all streets (all cities)
router.delete('/all', async (req, res) => {
  try {
    console.log('DELETE /all - Deleting all streets');
    const result = await Street.deleteMany({});
    res.json({ 
      message: 'Deleted all streets',
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Error deleting all streets:', err);
    res.status(500).json({ message: err.message });
  }
});

console.log('✅ Street routes loaded successfully');

module.exports = router;