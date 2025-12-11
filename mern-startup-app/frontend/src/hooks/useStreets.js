import { useState, useEffect } from 'react';
import { streetAPI } from '../services/api';

export function useStreets(count = 5) {
  const [streets, setStreets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStreets();
  }, [count]);

  const loadStreets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading streets from API...');
      const response = await streetAPI.getRandomStreets(count);
      
      if (response.data && response.data.length > 0) {
        console.log(`✅ Loaded ${response.data.length} streets from database`);
        setStreets(response.data);
      } else {
        console.log('No streets in database, using fallback data');
        // Fallback to local data if database is empty
        const fallbackStreets = await import('../data/streets');
        setStreets(fallbackStreets.streets);
      }
    } catch (err) {
      console.error('Error loading streets:', err);
      setError(err.message);
      
      // Fallback to local data on error
      const fallbackStreets = await import('../data/streets');
      setStreets(fallbackStreets.streets);
    } finally {
      setLoading(false);
    }
  };

  const refreshStreets = () => {
    loadStreets();
  };

  return { streets, loading, error, refreshStreets };
}