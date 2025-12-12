const mongoose = require('mongoose');

const streetSchema = new mongoose.Schema({
  osmId: {
    type: Number,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
  },
  coordinates: {
    type: [[Number]],
    required: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  type: {
    type: String,
  },
  city: {
    type: String,
    required: true,
    default: 'Albuquerque',
  },
  state: {
    type: String,
  },
  source: {
    type: String,
    default: 'openstreetmap',
  },
  length: {
    type: Number,
  },
  timesPlayed: {
    type: Number,
    default: 0,
  },
  timesCorrect: {
    type: Number,
    default: 0,
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for faster queries
streetSchema.index({ difficulty: 1 });
streetSchema.index({ city: 1 });
streetSchema.index({ city: 1, name: 1 });
streetSchema.index({ city: 1, source: 1 });

module.exports = mongoose.model('Street', streetSchema);