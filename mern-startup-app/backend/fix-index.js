const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/street-finder-game')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const Street = mongoose.model('Street', new mongoose.Schema({}, { strict: false }));
    
    // Drop the problematic index
    try {
      await Street.collection.dropIndex('osmId_1');
      console.log('✅ Dropped osmId_1 index');
    } catch (err) {
      console.log('Index might not exist:', err.message);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });