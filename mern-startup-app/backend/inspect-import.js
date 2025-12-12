const fs = require('fs');

const filePath = process.argv[2] || './test.geojson';

console.log('Inspecting:', filePath);

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('\n=== GeoJSON Overview ===');
console.log('Total features:', data.features?.length || 0);

if (data.features && data.features.length > 0) {
  // Count by street name
  const nameCount = {};
  data.features.forEach(f => {
    const name = f.properties.ROADNAME || f.properties.NAME || 'NO NAME';
    nameCount[name] = (nameCount[name] || 0) + 1;
  });
  
  console.log('\n=== Street Names and Counts ===');
  const sorted = Object.entries(nameCount).sort((a, b) => b[1] - a[1]);
  
  console.log('Top 20 streets by segment count:');
  sorted.slice(0, 20).forEach(([name, count]) => {
    console.log(`  ${name}: ${count} segments`);
  });
  
  console.log(`\nTotal unique street names: ${sorted.length}`);
  console.log(`Total segments: ${data.features.length}`);
  
  // Check coordinate ranges
  let minLat = 999, maxLat = -999, minLon = 999, maxLon = -999;
  
  data.features.forEach(f => {
    if (f.geometry?.type === 'LineString' && f.geometry.coordinates.length > 0) {
      f.geometry.coordinates.forEach(coord => {
        const [lon, lat] = coord;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      });
    }
  });
  
  console.log('\n=== Geographic Bounds ===');
  console.log(`Latitude:  ${minLat.toFixed(4)} to ${maxLat.toFixed(4)}`);
  console.log(`Longitude: ${minLon.toFixed(4)} to ${maxLon.toFixed(4)}`);
  
  console.log('\n=== Suggested Bounding Box ===');
  console.log(`{`);
  console.log(`  south: ${(minLat - 0.01).toFixed(2)},`);
  console.log(`  west: ${(minLon - 0.01).toFixed(2)},`);
  console.log(`  north: ${(maxLat + 0.01).toFixed(2)},`);
  console.log(`  east: ${(maxLon + 0.01).toFixed(2)}`);
  console.log(`}`);
}