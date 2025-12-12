const fs = require('fs');
const Street = require('../models/Street');
const streetMerger = require('./streetMerger');

class GeoJSONImportService {
  /**
   * Import streets from a GeoJSON file
   */
  async importFromGeoJSON(filePath, options = {}) {
    const {
      city = null,
      state = null,
      streetNameField = 'ROADNAME',
      roadTypeField = 'CLASS',
      cityBounds = null,
      minLength = 5,
    } = options;

    console.log(`Reading GeoJSON from: ${filePath}`);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!data.features || data.features.length === 0) {
      throw new Error('No features found in GeoJSON file');
    }

    console.log(`Found ${data.features.length} features in file`);

    const streets = this.parseGeoJSON(data, {
      city,
      state,
      streetNameField,
      roadTypeField,
      cityBounds,
      minLength,
    });

    console.log(`Parsed ${streets.length} valid streets`);

    return streets;
  }

  /**
   * Parse GeoJSON features into street objects
   */
  parseGeoJSON(data, options) {
    const streets = [];
    const cityBounds = options.cityBounds;

    let totalFeatures = 0;
    let filteredByName = 0;
    let filteredByCoords = 0;
    let filteredByBounds = 0;
    let accepted = 0;

    console.log('Parsing GeoJSON...');
    console.log('Total features in file:', data.features?.length || 0);
    console.log('Bounding box filter:', cityBounds ? 'YES' : 'NO');

    data.features.forEach((feature, index) => {
      totalFeatures++;

      try {
        const props = feature.properties;
        const geom = feature.geometry;

        // Get street name
        let streetName =
          props.ROADNAME ||
          props[options.streetNameField] ||
          props.FULLNAME ||
          props.NAME ||
          props.name;

        // Skip if no name or empty
        if (!streetName || streetName.trim() === '') {
          filteredByName++;
          return;
        }

        streetName = streetName.trim();

        // Get coordinates
        let coordinates = [];
        if (geom.type === 'LineString') {
          coordinates = geom.coordinates.map((coord) => [coord[1], coord[0]]);
        } else if (geom.type === 'MultiLineString') {
          let longest = [];
          geom.coordinates.forEach((lineString) => {
            if (lineString.length > longest.length) {
              longest = lineString;
            }
          });
          coordinates = longest.map((coord) => [coord[1], coord[0]]);
        }

        // Skip if not enough coordinates
        if (coordinates.length < options.minLength) {
          filteredByCoords++;
          return;
        }

        // Filter by bounding box if provided
        if (cityBounds) {
          const inBounds = coordinates.some(
            (coord) =>
              coord[0] >= cityBounds.south &&
              coord[0] <= cityBounds.north &&
              coord[1] >= cityBounds.west &&
              coord[1] <= cityBounds.east
          );

          if (!inBounds) {
            filteredByBounds++;
            return;
          }
        }

        // Get road class and difficulty
        const roadClass = props.CLASS || props[options.roadTypeField] || '4';
        const difficulty = this.assignDifficulty(roadClass, streetName);

        const city = options.city || props.JURISNAME || 'Unknown';
        const state = options.state || 'New Mexico';

        accepted++;

        streets.push({
          name: streetName,
          coordinates: coordinates,
          difficulty: difficulty,
          type: roadClass,
          city: city,
          state: state,
          source: 'usdot',
        });
      } catch (error) {
        console.error(`Error parsing feature ${index}:`, error.message);
      }
    });

    console.log('\n=== Import Summary ===');
    console.log(`Total features: ${totalFeatures}`);
    console.log(`No name: ${filteredByName}`);
    console.log(`Too few coords: ${filteredByCoords}`);
    console.log(`Outside bounds: ${filteredByBounds}`);
    console.log(`✅ Accepted: ${accepted}`);
    console.log(`Acceptance rate: ${((accepted / totalFeatures) * 100).toFixed(1)}%`);

    return streets;
  }

  /**
   * Assign difficulty based on road classification
   * CLASS values: 1=Interstate, 2=Primary, 3=Secondary, 4=Local
   */
  assignDifficulty(roadClass, streetName) {
    const classNum = parseInt(roadClass) || 4;

    // CLASS 1 = Interstate/Primary - Easy
    if (classNum === 1) return 'easy';

    // CLASS 2 = Primary Highway - Easy
    if (classNum === 2) return 'easy';

    // CLASS 3 = Secondary Road - Medium
    if (classNum === 3) return 'medium';

    // CLASS 4+ = Local Road - Hard
    return 'hard';
  }

  /**
   * Save streets to database
   */
  async saveToDatabase(streets, options = {}) {
    const { replaceDuplicates = true } = options;

    console.log(`Saving ${streets.length} streets to database...`);

    const saved = [];
    const errors = [];

    // Group by street name for efficiency
    const streetGroups = {};
    streets.forEach((street) => {
      const key = `${street.city}_${street.name}`;
      if (!streetGroups[key]) {
        streetGroups[key] = [];
      }
      streetGroups[key].push(street);
    });

    console.log(`Grouped into ${Object.keys(streetGroups).length} unique street names`);

    for (const [key, segments] of Object.entries(streetGroups)) {
      try {
        const firstSegment = segments[0];

        // Delete existing if replaceDuplicates
        if (replaceDuplicates) {
          await Street.deleteMany({
            name: firstSegment.name,
            city: firstSegment.city,
            source: 'usdot',
          });
        }

        // Save each segment
        for (const segment of segments) {
          const street = new Street({
            osmId: null,
            name: segment.name,
            coordinates: segment.coordinates,
            difficulty: segment.difficulty,
            type: segment.type,
            city: segment.city,
            length: segment.coordinates.length,
            source: segment.source,
            importedAt: new Date(),
          });

          await street.save();
        }

        saved.push({
          name: firstSegment.name,
          city: firstSegment.city,
          segments: segments.length,
        });

        if (saved.length % 10 === 0) {
          console.log(
            `Progress: ${saved.length}/${Object.keys(streetGroups).length} streets saved...`
          );
        }
      } catch (error) {
        console.error(`❌ Error saving ${key}:`, error.message);
        errors.push({ key, error: error.message });
      }
    }

    console.log(`\n✅ Saved ${saved.length} streets`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors`);
    }

    return { saved, errors };
  }

  /**
   * Get city bounding boxes
   */
  getCityBounds(cityName) {
    const bounds = {
      Albuquerque: { south: 34.97, west: -106.87, north: 35.29, east: -106.28 },
      'Santa Fe': { south: 35.6, west: -106.0, north: 35.75, east: -105.85 },
      'Las Cruces': { south: 32.25, west: -106.85, north: 32.4, east: -106.7 },
      Phoenix: { south: 33.35, west: -112.35, north: 33.65, east: -111.9 },
      Denver: { south: 39.6, west: -105.1, north: 39.8, east: -104.85 },
      'Los Angeles': { south: 33.95, west: -118.5, north: 34.15, east: -118.15 },
      'San Francisco': { south: 37.7, west: -122.52, north: 37.82, east: -122.35 },
      Seattle: { south: 47.5, west: -122.45, north: 47.73, east: -122.24 },
      Portland: { south: 45.46, west: -122.8, north: 45.65, east: -122.5 },
      Austin: { south: 30.15, west: -97.95, north: 30.5, east: -97.6 },
      Dallas: { south: 32.6, west: -97.0, north: 33.0, east: -96.6 },
      Houston: { south: 29.55, west: -95.7, north: 30.1, east: -95.15 },
    };

    return bounds[cityName];
  }

  /**
   * Complete workflow: Import and save for a city
   */
  async importCity(filePath, cityName) {
    console.log(`\n🌆 Importing streets for ${cityName}...`);

    const streets = await this.importFromGeoJSON(filePath, {
      city: cityName,
      cityBounds: null,
      minLength: 2,
    });

    if (streets.length === 0) {
      throw new Error(`No streets found in the file`);
    }

    console.log(`Parsed ${streets.length} segments, skipping merge for now`);

    // SKIP MERGER
    // const mergedStreets = streetMerger.mergeStreetSegments(streets, 0.5);

    // Save directly without merging
    const result = await this.saveToDatabase(streets, {
      replaceDuplicates: true,
    });

    console.log(`\n✅ Import complete!`);
    console.log(`   Segments saved: ${streets.length}`);
    console.log(`   Unique street names: ${result.saved.length}`);

    return result;
  }
}

module.exports = new GeoJSONImportService();
