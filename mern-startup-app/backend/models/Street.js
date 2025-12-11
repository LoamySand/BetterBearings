const mongoose = require('mongoose');

const streetSchema = new mongoose.Schema({
  osmId: {
    type: Number,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  name: {
    type: String,
    required: true,
  },
  coordinates: {
    type: [[Number]], // Array of [lat, lng] pairs
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  type: {
    type: String, // highway type from OSM (primary, secondary, tertiary)
  },
  city: {
    type: String,
    default: 'Albuquerque',
  },
  source: {
    type: String,
    default: 'openstreetmap',
  },
  length: {
    type: Number, // Number of coordinate points
  },
  timesPlayed: {
    type: Number,
    default: 0,
  },
  timesCorrect: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
streetSchema.index({ difficulty: 1 });
streetSchema.index({ city: 1 });

module.exports = mongoose.model('Street', streetSchema);