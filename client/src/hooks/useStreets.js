import { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { defaults } from '../utils/areaTypes';
import { networkError, responseError, emptyError } from '../utils/streetErrors';

// /api/streets returns lines as [lat, lng] pairs; the map and save code use { lat, lng } points
function toClientStreet({ coordinates, ...street }) {
  return {
    ...street,
    points: coordinates.map((line) => line.map(([lat, lng]) => ({ lat, lng }))),
  };
}

async function fetchStreets({ center, radius, difficulty, count }) {
  const params = new URLSearchParams({
    lat: center.lat,
    lng: center.lng,
    radius: Math.round(radius),
    difficulty,
    count: Math.min(count, 200),
  });

  let response;
  try {
    response = await fetch(`${API_URL}/streets?${params}`);
  } catch {
    throw networkError();
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw responseError(response.status, body);
  // An empty list says whether the circle has data at all (outside coverage) or not (KAN-63)
  if (!body.streets?.length) throw emptyError(body.hasData);
  return body.streets.map(toClientStreet);
}

/**
 * Loads game streets for a circle from GET /api/streets (KAN-58).
 * The server picks and merges streets in SQL; this hook only fetches and reshapes them.
 */
export function useStreets({
  center,
  radius = defaults.radius,
  difficulty = defaults.difficulty,
  numberOfQuestions = 10,
} = {}) {
  const [streets, setStreets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // What kind of failure, for utils/streetErrors.describeStreetError
  const [errorKind, setErrorKind] = useState(null);

  const loadStreets = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      setStreets(await fetchStreets({ center, radius, difficulty, count: numberOfQuestions }));
    } catch (err) {
      setError(err.message);
      setErrorKind(err.kind ?? 'server');
      setStreets([]);
    } finally {
      setLoading(false);
    }
  }, [center, radius, difficulty, numberOfQuestions]);

  return { streets, loading, error, errorKind, loadStreets };
}
