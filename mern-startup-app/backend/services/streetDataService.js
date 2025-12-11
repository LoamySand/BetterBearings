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
  async fetchStreetsByCity(city = 'Albuquerque', bounds = null, limit = 20) {
    // Default bounds for Albuquerque
    const defaultBounds = {
      south: 35.0,
      west: -106.75,
      north: 35.15,
      east: -106.5
    };

    const bbox = bounds || defaultBounds;
    
    // Overpass QL query to get major streets
    // We're filtering for primary, secondary, and tertiary roads which are main streets
    const query = `
      [out:json][timeout:25];
      (
        way["highway"~"primary|secondary|tertiary"]["name"]
          (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out geom ${limit};
    `;

    try {
      console.log('Fetching streets from Overpass API...');
      const response = await axios.post(this.overpassUrl, query, {
        headers: { 'Content-Type': 'text/plain' }
      });

      const streets = this.parseOverpassResponse(response.data);
      console.log(`✅ Fetched ${streets.length} streets`);
      
      return streets;
    } catch (error) {
      console.error('Error fetching streets:', error.message);
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
        ? element.geometry.map(node => [node.lat, node.lon])
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
        source: 'openstreetmap'
      };
    });

    // Filter out streets with too few coordinates (need at least 2 points for a line)
    const validStreets = streets.filter(street => street.coordinates.length >= 2);
    
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
        headers: { 'Content-Type': 'text/plain' }
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
    switch(difficulty) {
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
        headers: { 'Content-Type': 'text/plain' }
      });

      return this.parseOverpassResponse(response.data);
    } catch (error) {
      console.error('Error fetching streets by difficulty:', error.message);
      throw error;
    }
  }
}

module.exports = new StreetDataService();