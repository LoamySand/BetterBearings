// Sample street data for Albuquerque area
// You can expand this with real street coordinates
export const streets = [
  {
    id: 1,
    name: "Central Avenue",
    coordinates: [
      [35.0844, -106.6504],
      [35.0844, -106.6000],
    ],
    difficulty: "easy",
  },
  {
    id: 2,
    name: "Lomas Boulevard",
    coordinates: [
      [35.0900, -106.6504],
      [35.0900, -106.6000],
    ],
    difficulty: "easy",
  },
  {
    id: 3,
    name: "San Mateo Boulevard",
    coordinates: [
      [35.1200, -106.5800],
      [35.0700, -106.5800],
    ],
    difficulty: "medium",
  },
  {
    id: 4,
    name: "Tramway Boulevard",
    coordinates: [
      [35.1500, -106.5000],
      [35.0500, -106.5000],
    ],
    difficulty: "medium",
  },
  {
    id: 5,
    name: "Paseo del Norte",
    coordinates: [
      [35.1300, -106.6504],
      [35.1300, -106.5000],
    ],
    difficulty: "hard",
  },
];

export const getRandomStreet = () => {
  return streets[Math.floor(Math.random() * streets.length)];
};

export const getStreetsExcept = (excludeId) => {
  return streets.filter(street => street.id !== excludeId);
};