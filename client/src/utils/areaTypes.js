/**
 * Area selection shapes
 */
export const PresetAreaShape = {
  Circle: "circle",
  Square: "square",
  MultiPolygon: "multi-polygon"
};

/**
 * Difficulty levels that affect which highways are included
 */
export const Difficulty = {
  MajorStateRoads: "major-state-roads",
  Tourist: "tourist",
  Resident: "resident",
  TaxiDriver: "taxi-driver"
};

/**
 * Default settings
 */
export const defaults = {
  radius: 5000, // meters
  shape: PresetAreaShape.Circle,
  difficulty: Difficulty.Tourist
};
