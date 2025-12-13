import { PresetAreaShape } from './areaTypes';
import { 
  getBboxOfFeature, 
  getCenterOfFeature, 
  convertPositionToLatLng,
  capLng 
} from './geometryUtils';
import { getAllHighwayTypes } from './difficultySettings';

/**
 * Build Overpass query with spatial modifiers based on area selection
 */
export function makeOverpassQuery({ areaSelection }) {
  // Setting the bounding box is important - it massively speeds up the query
  const bbox = getBboxOfFeature(areaSelection.feature, 4);
  const bboxString = [bbox.south, bbox.west, bbox.north, bbox.east].join(',');
  
  // Spatial modifiers limit queries to specific bounds
  let spatialModifiers = [];
  
  if (areaSelection.presetShape === PresetAreaShape.Circle) {
    const centerLatLng = convertPositionToLatLng(
      getCenterOfFeature(areaSelection.feature)
    );
    const aroundValue = `${areaSelection.radius},${centerLatLng.lat},${capLng(centerLatLng.lng)}`;
    spatialModifiers.push(`(around:${aroundValue})`);
  } 
  else if (areaSelection.presetShape === PresetAreaShape.MultiPolygon) {
    if (areaSelection.feature.geometry.type !== 'MultiPolygon') {
      throw new Error(
        `MultiPolygon areaSelection has geometry type of ${areaSelection.feature.geometry.type}`
      );
    }
    
    // Build polygon spatial modifiers with hole exclusion support
    // Uses "stitched path" trick for polygons with inner rings
    spatialModifiers = areaSelection.feature.geometry.coordinates.map(rings => {
      let polyModifierValue = '';
      let firstLatLngPair;
      
      for (let i = 0; i < rings.length; i++) {
        const latLngPairs = rings[i].map(([lng, lat]) => `${lat} ${lng}`);
        
        firstLatLngPair = firstLatLngPair || latLngPairs[0];
        if (i) {
          // Repeat first outer point before inner ring
          polyModifierValue += ' ' + firstLatLngPair + ' ';
        }
        polyModifierValue += latLngPairs.join(' ');
      }
      
      if (rings.length > 1) {
        // Close the path after all inner rings
        polyModifierValue += ' ' + firstLatLngPair;
      }
      
      return `(poly:"${polyModifierValue}")`;
    });
  } 
  else {
    // Default to bbox
    spatialModifiers.push(`(${bboxString})`);
  }
  
  // Get all possible highway categories
  const highwayCategories = getAllHighwayTypes();
  const highwayRegex = `^(${highwayCategories.join('||')})$`;
  
  // Build the Overpass query
  const overpassQueryLines = [`[out:json][bbox:${bboxString}];`, `(`];
  
  // Add query statements for each spatial modifier
  for (const spatialModifier of spatialModifiers) {
    overpassQueryLines.push(
      `(`,
      // Streets/highways
      `way${spatialModifier}[highway~"${highwayRegex}"][name];`,
      // Historic POIs
      `way${spatialModifier}[historic~"^(castle|fort|monument|ruins|ship|tower)$"][name][wikidata];`,
      // Tourism POIs
      `way${spatialModifier}[tourism~"^(aquarium|museum|zoo)$"][name][wikidata];`,
      `);`
    );
  }
  
  overpassQueryLines.push(`);`, `out tags geom;`);
  
  return overpassQueryLines.join('');
}

/**
 * Get cache key for localStorage based on query
 */
export function getCacheKey(overpassQuery) {
  return `overpass-response2__${overpassQuery})`;
}
