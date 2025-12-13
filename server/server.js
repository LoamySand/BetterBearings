const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
//require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/api', (req, res) => {
  res.json({ message: 'How local are you?' });
});

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/scores', require('./routes/scoreRoutes'));
app.use('/api/streets', require('./routes/streetRoutes'));

// Serve static files from the frontend build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'client', 'build');
  app.use(express.static(buildPath));

  // For client-side routing, return index.html for unknown routes
  app.get('/{*any}', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-startup', {})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
