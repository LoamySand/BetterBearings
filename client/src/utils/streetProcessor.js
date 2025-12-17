import { convertOverpassLatLngToLatLng, isElementAnEnclosedArea } from './geometryUtils';
import { shouldExcludeStreet } from './exclusions';
import { matchesDifficulty, isAccessible, usMajorStateRoadRegex } from './difficultySettings';
import { Difficulty } from './areaTypes';

// Minimum street length in meters (approximately one city block)
const MIN_STREET_LENGTH_METERS = 150;

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate total length of a street segment
 */
function calculateSegmentLength(geometry) {
  if (!geometry || geometry.length < 2) return 0;
  
  let totalLength = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    const p1 = geometry[i];
    const p2 = geometry[i + 1];
    totalLength += calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
  }
  
  return totalLength;
}

/**
 * Check if element has sufficient length
 */
function hasMinimumLength(element) {
  const length = calculateSegmentLength(element.geometry);
  return length >= MIN_STREET_LENGTH_METERS;
}

/**
 * Get street names from Overpass element
 * Returns up to 2 names: main name and alternative name
 */
function getNamesFromElement(element) {
  const result = { name: element.tags.name };
  
  // Check for Irish Gaelic name
  if (element.tags['name:ga'] && 
      element.tags['name:ga'] !== element.tags.name &&
      element.tags['name:ga'] !== '-' && 
      element.tags['name:ga'].toLowerCase() !== 'n/a') {
    result.alternativeName = element.tags['name:ga'];
    result.alternativeNameLanguageCode = 'ga';
    return result;
  }
  
  // Check for old name
  if (element.tags.old_name && 
      element.tags.old_name !== element.tags.name) {
    result.alternativeName = element.tags.old_name;
    return result;
  }
  
  // Check for local name
  if (element.tags.loc_name && 
      element.tags.loc_name !== element.tags.name) {
    result.alternativeName = element.tags.loc_name;
    return result;
  }
  
  // Check for ref (reference number) for major roads
  if (element.tags.ref && 
      element.tags.ref !== element.tags.name &&
      usMajorStateRoadRegex.test(element.tags.ref)) {
    result.alternativeName = element.tags.ref;
    return result;
  }
  
  return result;
}

/**
 * Adjust street details - group segments by name and combine into single target
 */
function adjustStreetDetails(targetElement, allElements) {
  // Find all segments with the same name
  const equivalentTargets = [
    targetElement,
    ...allElements.filter(element =>
      element.id !== targetElement.id &&
      element.tags.name === targetElement.tags.name
    )
  ];
  
  // Convert all geometries to our LatLng format
  const points = equivalentTargets.map(({ geometry }) =>
    geometry.map(convertOverpassLatLngToLatLng)
  );
  
  // Parse width if available
  let width;
  const widths = equivalentTargets.map(({ tags }) => {
    const match = tags.width?.match(/^(\d+(\.\d+)?)( ?m)?$/);
    if (match) {
      return parseFloat(match[1]);
    }
    return undefined;
  });
  
  const widthsThatExist = widths.filter(w => typeof w === 'number');
  if (widthsThatExist.length) {
    width = widthsThatExist.reduce((a, b) => a + b, 0) / widthsThatExist.length;
  }
  
  // Calculate total length of all segments
  const totalLength = equivalentTargets.reduce((sum, element) => {
    return sum + calculateSegmentLength(element.geometry);
  }, 0);
  
  return {
    ...getNamesFromElement(targetElement),
    osmId: targetElement.id,
    type: targetElement.tags.highway,
    length: totalLength,
    isEnclosedArea: equivalentTargets.some(element =>
      isElementAnEnclosedArea(element, [element.geometry.map(convertOverpassLatLngToLatLng)])
    ),
    points,
    width
  };
}

/**
 * Group streets by name and filter based on difficulty and exclusions
 */
export function processOverpassElements({ elements, difficulty, numberOfQuestions }) {
  const results = [];
  const pot = {}; // Map of street name -> array of all segments with that name
  
  console.log(`Processing ${elements.length} elements for difficulty: ${difficulty}`);
  
  // Filter and group by name
  for (const element of elements) {
    const key = element.tags.name?.toLowerCase();
    
    if (!key) continue;
    
    // Apply exclusions
    if (shouldExcludeStreet(element)) {
      continue;
    }
    
    // Apply difficulty filter
    if (!matchesDifficulty(element, difficulty)) {
      continue;
    }
    
    // Check accessibility
    if (!isAccessible(element, difficulty)) {
      continue;
    }
    
    // Filter out segments that are too small (less than a city block)
    if (!hasMinimumLength(element)) {
      continue;
    }
    
    // Group all segments with the same name
    if (!pot[key]) {
      pot[key] = [];
    }
    pot[key].push(element);
  }
  
  const potKeys = Object.keys(pot);
  console.log(`After filtering: ${potKeys.length} unique street names`);
  
  // Randomly select streets
  for (let i = 0; i < numberOfQuestions; i++) {
    if (potKeys.length === 0) {
      console.warn('Ran out of streets to select');
      break;
    }
    
    // Pick a random key
    const randomIndex = Math.floor(Math.random() * potKeys.length);
    const key = potKeys[randomIndex];
    
    if (!key) break;
    
    // Get the first element from this group and combine all segments with same name
    const segmentsForThisStreet = pot[key];
    const targetElement = segmentsForThisStreet[0];
    const adjustedStreet = adjustStreetDetails(targetElement, elements);
    
    results.push(adjustedStreet);
    
    // Remove from pot and keys array
    delete pot[key];
    potKeys.splice(randomIndex, 1);
  }
  
  console.log(`Selected ${results.length} streets for game`);
  return results;
}

/**
 * Get random item from array
 */
function getRandomItem(array) {
  if (array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}
