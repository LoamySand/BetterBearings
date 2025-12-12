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
      console.log('Calling API:', `http://localhost:5000/api/streets/random-complete/${count}?city=${city}`);
      
      const response = await streetAPI.getRandomCompleteStreets(count, city);
      
      console.log('API Response:', response.data);
      
      if (response.data && response.data.length > 0) {
        console.log(`✅ Loaded ${response.data.length} streets for ${city}`);
        
        response.data.forEach(s => {
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
      segments: [{
        coordinates: [
          [35.0844, -106.6900],
          [35.0844, -106.6800],
          [35.0844, -106.6700],
          [35.0844, -106.6600],
          [35.0844, -106.6500],
          [35.0844, -106.6400],
          [35.0844, -106.6300],
          [35.0844, -106.6200],
        ]
      }],
      segmentCount: 1,
      difficulty: 'easy',
      city: 'Albuquerque'
    },
    {
      id: 'fallback_2',
      name: 'Lomas Boulevard',
      segments: [{
        coordinates: [
          [35.0900, -106.6900],
          [35.0900, -106.6800],
          [35.0900, -106.6700],
          [35.0900, -106.6600],
          [35.0900, -106.6500],
          [35.0900, -106.6400],
        ]
      }],
      segmentCount: 1,
      difficulty: 'medium',
      city: 'Albuquerque'
    },
    {
      id: 'fallback_3',
      name: 'San Mateo Boulevard',
      segments: [{
        coordinates: [
          [35.1400, -106.5900],
          [35.1300, -106.5900],
          [35.1200, -106.5900],
          [35.1100, -106.5900],
          [35.1000, -106.5900],
          [35.0900, -106.5900],
        ]
      }],
      segmentCount: 1,
      difficulty: 'medium',
      city: 'Albuquerque'
    },
    {
      id: 'fallback_4',
      name: 'Tramway Boulevard',
      segments: [{
        coordinates: [
          [35.1500, -106.5200],
          [35.1400, -106.5200],
          [35.1300, -106.5200],
          [35.1200, -106.5200],
          [35.1100, -106.5200],
          [35.1000, -106.5200],
        ]
      }],
      segmentCount: 1,
      difficulty: 'hard',
      city: 'Albuquerque'
    },
    {
      id: 'fallback_5',
      name: 'Paseo del Norte',
      segments: [{
        coordinates: [
          [35.1300, -106.6900],
          [35.1300, -106.6800],
          [35.1300, -106.6700],
          [35.1300, -106.6600],
          [35.1300, -106.6500],
        ]
      }],
      segmentCount: 1,
      difficulty: 'easy',
      city: 'Albuquerque'
    }
  ];
}