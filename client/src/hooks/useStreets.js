import { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { defaults } from '../utils/areaTypes';

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
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // 400 (validation), 429 (rate limit) and 503 (no street data yet) all carry a message
    throw new Error(body.message || `Could not load streets (HTTP ${response.status})`);
  }
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

  const loadStreets = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStreets({ center, radius, difficulty, count: numberOfQuestions });
      if (result.length === 0) {
        throw new Error(
          'No suitable streets found. Try increasing the difficulty or selecting a different area.'
        );
      }
      setStreets(result);
    } catch (err) {
      setError(err.message);
      setStreets([]);
    } finally {
      setLoading(false);
    }
  }, [center, radius, difficulty, numberOfQuestions]);

  return { streets, loading, error, loadStreets };
}
