import { convertOverpassLatLngToLatLng, isElementAnEnclosedArea } from './geometryUtils';
import { shouldExcludeStreet } from './exclusions';
import { matchesDifficulty, isAccessible, usMajorStateRoadRegex } from './difficultySettings';
import { Difficulty } from './areaTypes';

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
  
  return {
    ...getNamesFromElement(targetElement),
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
  const pot = {}; // One entry per unique street name
  
  console.log(`Processing ${elements.length} elements for difficulty: ${difficulty}`);
  
  // Filter and deduplicate by name
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
    
    // Only keep one entry per unique name (deduplicate)
    pot[key] = element;
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
    
    // Get the element and combine all segments with same name
    const targetElement = pot[key];
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
