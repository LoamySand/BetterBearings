const streetDataService = require('./services/streetDataService');

async function test() {
  try {
    console.log('=== Testing OpenStreetMap Overpass API ===\n');
    
    // Test 1: Fetch random streets
    console.log('1. Fetching 5 random streets from Albuquerque:');
    const streets = await streetDataService.fetchRandomStreets(5);
    
    if (streets.length === 0) {
      console.log('❌ No streets found. Check your internet connection or Overpass API status.');
      return;
    }
    
    streets.forEach(street => {
      console.log(`\n  📍 ${street.name}`);
      console.log(`     Type: ${street.type}`);
      console.log(`     Difficulty: ${street.difficulty}`);
      console.log(`     Coordinates: ${street.coordinates.length} points`);
      console.log(`     First point: [${street.coordinates[0][0]}, ${street.coordinates[0][1]}]`);
    });
    
    // Test 2: Search for a specific street
    console.log('\n\n2. Searching for "Central Avenue":');
    const centralAve = await streetDataService.searchStreet('Central');
    console.log(`   Found ${centralAve.length} matches`);
    
    if (centralAve.length > 0) {
      console.log(`   First match: ${centralAve[0].name}`);
      console.log(`   Coordinates: ${centralAve[0].coordinates.length} points`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();