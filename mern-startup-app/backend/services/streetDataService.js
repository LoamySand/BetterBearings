const axios = require('axios');

class StreetDataService {
  constructor() {
    this.overpassUrl = 'https://overpass-api.de/api/interpreter';
  }

  /**
   * Fetch streets from a specific city using Overpass API
   * @param {string} city - City name
   * @param {object} bounds - {south, west, north, east}
   * @param {number} limit - Number of streets to fetch
   */
  /**
   * Fetch ALL segments of streets from a specific city
   */
  async fetchStreetsByCity(city = 'Albuquerque', bounds = null, limit = 50) {
    const defaultBounds = {
      south: 35.0,
      west: -106.75,
      north: 35.15,
      east: -106.5,
    };

    const bbox = bounds || defaultBounds;

    // Modified query to get ALL segments of each street
    // We remove the limit from inside the query and apply it after grouping
    const query = `
    [out:json][timeout:60];
    (
      way["highway"~"primary|secondary|tertiary"]["name"]
        (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out geom;
  `;

    try {
      console.log('Fetching streets from Overpass API...');
      console.log('This may take up to 60 seconds...');

      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 70000, // 70 second timeout
      });

      const streets = this.parseOverpassResponse(response.data);
      console.log(`✅ Fetched ${streets.length} total street segments`);

      // Group by street name to see what we have
      const grouped = {};
      streets.forEach((street) => {
        if (!grouped[street.name]) {
          grouped[street.name] = [];
        }
        grouped[street.name].push(street);
      });

      console.log(`📊 Unique street names: ${Object.keys(grouped).length}`);
      Object.keys(grouped)
        .slice(0, 10)
        .forEach((name) => {
          console.log(`  ${name}: ${grouped[name].length} segments`);
        });

      return streets;
    } catch (error) {
      console.error('Error fetching streets:', error.message);
      throw error;
    }
  }
  /**
   * Fetch ALL segments of specific street names
   */
  async fetchCompleteStreets(streetNames, bounds = null) {
    const defaultBounds = {
      south: 35.0,
      west: -106.75,
      north: 35.15,
      east: -106.5,
    };

    const bbox = bounds || defaultBounds;

    // Build a regex pattern for the street names
    const namePattern = streetNames.join('|');

    const query = `
    [out:json][timeout:60];
    (
      way["highway"]["name"~"${namePattern}",i]
        (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out geom;
  `;

    try {
      console.log(`Fetching all segments for streets: ${streetNames.join(', ')}`);

      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 70000,
      });

      return this.parseOverpassResponse(response.data);
    } catch (error) {
      console.error('Error fetching complete streets:', error.message);
      throw error;
    }
  }

  /**
   * Get a list of major street names first, then fetch all their segments
   */
  async fetchMajorStreetsComplete(count = 10) {
    try {
      // Step 1: Get unique street names
      console.log('Step 1: Getting list of major street names...');
      const allSegments = await this.fetchStreetsByCity('Albuquerque', null, 200);

      // Group by name
      const streetGroups = {};
      allSegments.forEach((segment) => {
        if (!streetGroups[segment.name]) {
          streetGroups[segment.name] = {
            name: segment.name,
            segments: [],
            difficulty: segment.difficulty,
          };
        }
        streetGroups[segment.name].segments.push(segment);
      });

      // Get unique street names
      const streetNames = Object.keys(streetGroups);
      console.log(`Found ${streetNames.length} unique streets`);

      // Pick random streets
      const shuffled = streetNames.sort(() => 0.5 - Math.random());
      const selectedNames = shuffled.slice(0, count);

      console.log(`Selected streets: ${selectedNames.join(', ')}`);

      // Step 2: For each selected street, get ALL segments
      console.log('Step 2: Fetching all segments for selected streets...');
      const completeStreets = [];

      for (const name of selectedNames) {
        const segments = streetGroups[name].segments;
        console.log(`  ${name}: ${segments.length} segments`);
        completeStreets.push(...segments);
      }

      console.log(
        `✅ Total segments for ${selectedNames.length} complete streets: ${completeStreets.length}`
      );

      return completeStreets;
    } catch (error) {
      console.error('Error fetching major streets:', error.message);
      throw error;
    }
  }

  /**
   * Parse Overpass API response to our street format
   */
  parseOverpassResponse(data) {
    if (!data.elements || data.elements.length === 0) {
      console.log('No streets found in response');
      return [];
    }

    const streets = data.elements.map((element, index) => {
      // Extract coordinates from geometry
      const coordinates = element.geometry
        ? element.geometry.map((node) => [node.lat, node.lon])
        : [];

      // Determine difficulty based on street type
      const highway = element.tags.highway;
      let difficulty = 'medium';
      if (highway === 'primary') difficulty = 'easy';
      if (highway === 'tertiary') difficulty = 'hard';

      return {
        id: element.id,
        name: element.tags.name || `Street ${index + 1}`,
        coordinates: coordinates,
        difficulty: difficulty,
        type: highway,
        length: coordinates.length,
        source: 'openstreetmap',
      };
    });

    // Filter out streets with too few coordinates (need at least 2 points for a line)
    const validStreets = streets.filter((street) => street.coordinates.length >= 2);

    console.log(`Parsed ${validStreets.length} valid streets`);
    return validStreets;
  }

  /**
   * Fetch a random selection of streets
   */
  async fetchRandomStreets(count = 10) {
    const allStreets = await this.fetchStreetsByCity('Albuquerque', null, 50);

    // Shuffle and pick random streets
    const shuffled = allStreets.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Search for a specific street by name
   */
  async searchStreet(streetName, city = 'Albuquerque') {
    const query = `
      [out:json][timeout:25];
      area["name"="${city}"]["admin_level"="8"]->.searchArea;
      (
        way["highway"]["name"~"${streetName}",i](area.searchArea);
      );
      out geom;
    `;

    try {
      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
      });

      return this.parseOverpassResponse(response.data);
    } catch (error) {
      console.error('Error searching street:', error.message);
      throw error;
    }
  }

  /**
   * Fetch streets by difficulty for game balance
   */
  async fetchStreetsByDifficulty(difficulty = 'medium', count = 10) {
    let highwayType;
    switch (difficulty) {
      case 'easy':
        highwayType = 'primary';
        break;
      case 'hard':
        highwayType = 'tertiary';
        break;
      default:
        highwayType = 'secondary';
    }

    const query = `
      [out:json][timeout:25];
      (
        way["highway"="${highwayType}"]["name"]
          (35.0,-106.75,35.15,-106.5);
      );
      out geom ${count};
    `;

    try {
      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' },
      });

      return this.parseOverpassResponse(response.data);
    } catch (error) {
      console.error('Error fetching streets by difficulty:', error.message);
      throw error;
    }
  }
}

module.exports = new StreetDataService();
