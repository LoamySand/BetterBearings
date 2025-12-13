import { useState, useEffect } from 'react';
import { streetAPI } from '../services/api';

export function useStreets(count = 5, city = 'Albuquerque') {
  const [streets, setStreets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStreets();
  }, [count, city]);

  const loadStreets = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Loading ${count} streets for ${city}...`);
      console.log(
        'Calling API:',
        `http://localhost:5000/api/streets/random-complete/${count}?city=${city}`
      );

      const response = await streetAPI.getRandomCompleteStreets(count, city);

      console.log('API Response:', response.data);

      if (response.data && response.data.length > 0) {
        console.log(`✅ Loaded ${response.data.length} streets for ${city}`);

        response.data.forEach((s) => {
          console.log(`  📍 ${s.name}: ${s.segmentCount} segments`);
          console.log(`     Segments array length:`, s.segments?.length || 0);
        });

        setStreets(response.data);
      } else {
        console.log(`No streets in database for ${city}, using fallback`);
        const fallbackStreets = getFallbackStreets();
        setStreets(fallbackStreets.slice(0, count));
      }
    } catch (err) {
      console.error('Error loading streets:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(err.message);

      const fallbackStreets = getFallbackStreets();
      setStreets(fallbackStreets.slice(0, count));
    } finally {
      setLoading(false);
    }
  };

  const refreshStreets = () => {
    loadStreets();
  };

  return { streets, loading, error, refreshStreets };
}

// Fallback streets if database is empty
function getFallbackStreets() {
  return [
    {
      id: 'fallback_1',
      name: 'Central Avenue',
      segments: [
        {
          coordinates: [
            [35.0844, -106.69],
            [35.0844, -106.68],
            [35.0844, -106.67],
            [35.0844, -106.66],
            [35.0844, -106.65],
            [35.0844, -106.64],
            [35.0844, -106.63],
            [35.0844, -106.62],
          ],
        },
      ],
      segmentCount: 1,
      difficulty: 'easy',
      city: 'Albuquerque',
    },
    {
      id: 'fallback_2',
      name: 'Lomas Boulevard',
      segments: [
        {
          coordinates: [
            [35.09, -106.69],
            [35.09, -106.68],
            [35.09, -106.67],
            [35.09, -106.66],
            [35.09, -106.65],
            [35.09, -106.64],
          ],
        },
      ],
      segmentCount: 1,
      difficulty: 'medium',
      city: 'Albuquerque',
    },
    {
      id: 'fallback_3',
      name: 'San Mateo Boulevard',
      segments: [
        {
          coordinates: [
            [35.14, -106.59],
            [35.13, -106.59],
            [35.12, -106.59],
            [35.11, -106.59],
            [35.1, -106.59],
            [35.09, -106.59],
          ],
        },
      ],
      segmentCount: 1,
      difficulty: 'medium',
      city: 'Albuquerque',
    },
    {
      id: 'fallback_4',
      name: 'Tramway Boulevard',
      segments: [
        {
          coordinates: [
            [35.15, -106.52],
            [35.14, -106.52],
            [35.13, -106.52],
            [35.12, -106.52],
            [35.11, -106.52],
            [35.1, -106.52],
          ],
        },
      ],
      segmentCount: 1,
      difficulty: 'hard',
      city: 'Albuquerque',
    },
    {
      id: 'fallback_5',
      name: 'Paseo del Norte',
      segments: [
        {
          coordinates: [
            [35.13, -106.69],
            [35.13, -106.68],
            [35.13, -106.67],
            [35.13, -106.66],
            [35.13, -106.65],
          ],
        },
      ],
      segmentCount: 1,
      difficulty: 'easy',
      city: 'Albuquerque',
    },
  ];
}
