import { Difficulty } from './areaTypes';

/**
 * Map difficulty levels to highway categories
 */
const difficultiesToHighwayCategories = {
  [Difficulty.Tourist]: ["motorway", "primary", "secondary", "trunk"],
};

difficultiesToHighwayCategories[Difficulty.Resident] = [
  ...difficultiesToHighwayCategories[Difficulty.Tourist],
  "cycleway",
  "tertiary"
];

difficultiesToHighwayCategories[Difficulty.TaxiDriver] = [
  ...difficultiesToHighwayCategories[Difficulty.Resident],
  "living_street",
  "pedestrian",
  "residential",
  "service",
  "steps",
  "unclassified"
];

/**
 * US Major State Road regex
 */
export const usMajorStateRoadRegex = /^(I-|US |SR |State Route )\d+/i;

/**
 * Get highway categories for difficulty level
 */
export function getHighwayTypesForDifficulty(difficulty) {
  return difficultiesToHighwayCategories[difficulty] || 
         difficultiesToHighwayCategories[Difficulty.Tourist];
}

/**
 * Get all unique highway types (for query building)
 */
export function getAllHighwayTypes() {
  return Object.values(difficultiesToHighwayCategories)
    .flat()
    .filter((value, index, self) => self.indexOf(value) === index);
}

/**
 * Check if element matches difficulty requirements
 */
export function matchesDifficulty(element, difficulty) {
  if (difficulty === Difficulty.MajorStateRoads) {
    return element.tags?.ref && usMajorStateRoadRegex.test(element.tags.ref);
  }
  
  const allowedHighways = getHighwayTypesForDifficulty(difficulty);
  return element.tags.highway && allowedHighways.includes(element.tags.highway);
}

/**
 * Check if element is accessible (not private)
 */
export function isAccessible(element, difficulty) {
  if (difficulty === Difficulty.TaxiDriver) {
    return true; // Include everything for taxi driver
  }
  return element.tags.access !== 'private';
}
