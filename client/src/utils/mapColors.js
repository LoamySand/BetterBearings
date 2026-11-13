// Colors drawn on the Leaflet maps (KAN-81). Leaflet writes them into SVG attributes, which
// can't read CSS variables, so they live here. Brand values match :root in index.css.
// Streets rest in link blue, so they read as clickable (Lane's call, Nov 13); yellow marks the
// one in focus. Correct and wrong are brighter than the brand green and red so they stand out.
export const MAP_COLORS = {
  street: '#3b82f6',
  hover: '#f5c400', // --bb-yellow
  highlight: '#f5c400',
  correct: '#12a150',
  wrong: '#e0352b',
  area: '#0b6b4a', // --bb-green: the quiz circle
  areaTooSmall: '#b42318', // --bb-red
  // Street-set detail map
  included: '#3b82f6',
  excluded: '#9ca3af',
  selected: '#f5c400', // the street picked in the list
};
