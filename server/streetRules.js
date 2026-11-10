// Which streets can become questions (KAN-57). /api/streets applies these in SQL; they were
// ported from the browser's Overpass processing, removed in KAN-58.
// osm.streets holds every named highway (KAN-56); these rules pick the game's subset.

const TOURIST = ['motorway', 'primary', 'secondary', 'trunk'];
const RESIDENT = [...TOURIST, 'cycleway', 'tertiary'];
const TAXI_DRIVER = [
  ...RESIDENT,
  'living_street',
  'pedestrian',
  'residential',
  'service',
  'steps',
  'unclassified',
];

const DIFFICULTIES = ['major-state-roads', 'tourist', 'resident', 'taxi-driver'];

// Per-street label stored in a street set (KAN-73): 1 Easy, 2 Medium, 3 Hard. Same tiers as the
// Current Location difficulties, so an Easy set holds only Easy streets. `type` is the street's
// dominant road class (most meters), picked in db/streets.js.
function levelFor(type) {
  if (TOURIST.includes(type)) return 1;
  if (RESIDENT.includes(type)) return 2;
  return 3;
}

// Every type a game can use. Same-name segments of these types merge into one street, even
// when only some of them pass the chosen difficulty's rules.
const GAME_TYPES = TAXI_DRIVER;

// Major state roads match on ref, not type. Postgres regex, same as the client's JS one.
const MAJOR_REF_PATTERN = '^(I-|US |SR |State Route )[0-9]+';

const EXCLUDED_NAMES = [
  'alley',
  'buses and taxis',
  'drive thru',
  'escalator',
  'treppe tiefgarage',
  'tunnel entrance street',
  'zugang steig',
  'parking',
  'driveway',
  'access road',
  'fire road',
];
const EXCLUDED_NAME_PATTERN = '^(unnamed|private|service)'; // matched against lower(name)

const MIN_SEGMENT_METERS = 150; // about one city block

function rulesFor(difficulty) {
  const types = {
    'major-state-roads': GAME_TYPES,
    tourist: TOURIST,
    resident: RESIDENT,
    'taxi-driver': TAXI_DRIVER,
  }[difficulty];
  return {
    types,
    refPattern: difficulty === 'major-state-roads' ? MAJOR_REF_PATTERN : null,
    allowPrivate: difficulty === 'taxi-driver',
  };
}

module.exports = {
  DIFFICULTIES,
  GAME_TYPES,
  MAJOR_REF_PATTERN,
  EXCLUDED_NAMES,
  EXCLUDED_NAME_PATTERN,
  MIN_SEGMENT_METERS,
  rulesFor,
  levelFor,
  // For the level in PICK_SQL (KAN-75); same tiers as levelFor
  TOURIST,
  RESIDENT,
};
