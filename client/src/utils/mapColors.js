// Colors drawn on the Leaflet maps (KAN-81). Leaflet writes them into SVG attributes, which
// can't read CSS variables, so they live here. Brand values match :root in index.css.
// Streets rest in ink and the states carry the color. Correct and wrong are brighter than the
// brand green and red, so they stand out from the dark streets around them.
export const MAP_COLORS = {
  street: '#14231d', // --bb-ink
  hover: '#f5c400', // --bb-yellow
  highlight: '#f5c400',
  correct: '#12a150',
  wrong: '#e0352b',
  area: '#0b6b4a', // --bb-green: the quiz circle
  areaTooSmall: '#b42318', // --bb-red
};
