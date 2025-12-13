const fs = require('fs');

// Change this to match your file path
const filePath = process.argv[2] || './test.geojson';

console.log('Inspecting:', filePath);

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('\n=== GeoJSON Structure ===');
console.log('Type:', data.type);
console.log('Total features:', data.features?.length || 0);

if (data.features && data.features.length > 0) {
  console.log('\n=== First Feature ===');
  const first = data.features[0];

  console.log('Geometry type:', first.geometry?.type);
  console.log('Properties:', Object.keys(first.properties || {}));

  console.log('\n=== Property Values (first feature) ===');
  Object.entries(first.properties || {}).forEach(([key, value]) => {
    console.log(`  ${key}:`, value);
  });

  console.log('\n=== Sample of street names ===');
  const names = data.features
    .slice(0, 10)
    .map((f) => f.properties.FULLNAME || f.properties.NAME || f.properties.name || 'NO NAME')
    .filter((name) => name !== 'NO NAME');

  console.log(names);
}
