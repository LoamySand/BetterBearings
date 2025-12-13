import * as turf from '@turf/turf';
import isPointInPolygon from 'point-in-polygon';

/**
 * Cap longitude to valid range
 */
export function capLng(lng) {
  if (lng > 180) {
    return lng - 360;
  }
  if (lng < -180) {
    return lng + 360;
  }
  return lng;
}

/**
 * Convert LatLng to [lat, lng] coordinates
 */
export function convertLatLngToCoordinates(latlng) {
  return [latlng.lat, capLng(latlng.lng)];
}

/**
 * Convert Overpass LatLng {lat, lon} to {lat, lng}
 */
export function convertOverpassLatLngToLatLng({ lat, lon }) {
  return { lat, lng: lon };
}

/**
 * Get bounding box of a GeoJSON feature
 */
export function getBboxOfFeature(feature, numberOfDecimalPoints = 4) {
  let turfArray = turf.bbox(feature);
  
  if (numberOfDecimalPoints !== Infinity) {
    turfArray = turfArray.map(item => 
      parseFloat(item.toFixed(numberOfDecimalPoints))
    );
  }
  
  const [west, south, east, north] = turfArray;
  
  return { east, north, south, west, turfArray };
}

/**
 * Get center of a GeoJSON feature
 */
export function getCenterOfFeature(feature) {
  const centerPoint = turf.center(feature);
  return centerPoint.geometry.coordinates;
}

/**
 * Create a GeoJSON feature from area shape and center
 */
export function createFeatureFromPresetAreaShape(presetAreaShape, centerPosition, radius) {
  if (presetAreaShape === 'circle') {
    return turf.circle(turf.point(centerPosition), radius / 1000);
  }
  
  if (presetAreaShape === 'square') {
    const radiusInDegrees = radius / 111320;
    const squareBbox = [
      centerPosition[0] - radiusInDegrees,
      centerPosition[1] - radiusInDegrees,
      centerPosition[0] + radiusInDegrees,
      centerPosition[1] + radiusInDegrees
    ];
    return turf.bboxPolygon(squareBbox);
  }
  
  throw new Error(`Unexpected shape ${presetAreaShape}`);
}

/**
 * Convert position to LatLng
 */
export function convertPositionToLatLng(position) {
  return { lat: position[1], lng: position[0] };
}

/**
 * Convert LatLng to position
 */
export function convertLatLngToPosition(latLng) {
  return [capLng(latLng.lng), latLng.lat];
}

/**
 * Check if element is an enclosed area
 */
export function isElementAnEnclosedArea(element, points) {
  if (element.tags.area === "yes") {
    return true;
  }
  
  const flattenedPoints = points.flat(2);
  const lastIndex = flattenedPoints.length - 1;
  
  return (
    flattenedPoints[0].lat === flattenedPoints[lastIndex].lat &&
    flattenedPoints[0].lng === flattenedPoints[lastIndex].lng
  );
}

/**
 * Check if a LatLng is inside a polygon
 */
export function isLatLngInsidePolygon(latLng, polygonPoints) {
  const polygonCoordinates = polygonPoints.map(convertLatLngToCoordinates);
  let safePolygonCoordinates;
  
  // point-in-polygon doesn't like an unnecessary level
  if (polygonCoordinates.length === 1 && typeof polygonCoordinates[0] !== 'number') {
    safePolygonCoordinates = polygonCoordinates[0];
  } else {
    safePolygonCoordinates = polygonCoordinates;
  }
  
  try {
    return isPointInPolygon(
      convertLatLngToCoordinates(latLng),
      safePolygonCoordinates
    );
  } catch (e) {
    return false;
  }
}
