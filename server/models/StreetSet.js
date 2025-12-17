const mongoose = require('mongoose');

const streetItemSchema = new mongoose.Schema({
  osmId: {
    type: Number,
  },
  name: {
    type: String,
    required: true,
  },
  coordinates: {
    type: [[[Number]]], // Array of polylines, each polyline is array of [lat, lng] pairs
  },
  type: {
    type: String,
  },
  length: {
    type: Number,
  },
  width: {
    type: Number,
  },
  alternativeName: {
    type: String,
  },
  isEnclosedArea: {
    type: Boolean,
    default: false,
  },
  included: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const streetSetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  center: {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  radius: {
    type: Number,
    required: true,
  },
  streets: [streetItemSchema],
  totalStreets: {
    type: Number,
    default: 0,
  },
  includedStreets: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamps on save
streetSetSchema.pre('save', async function() {
  this.updatedAt = Date.now();
  this.totalStreets = this.streets.length;
  this.includedStreets = this.streets.filter(s => s.included).length;
});

module.exports = mongoose.model('StreetSet', streetSetSchema);
