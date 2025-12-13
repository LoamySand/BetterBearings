import { useState, useCallback } from 'react';
import { fetchOverpassData } from '../utils/overpassFetcher';
import { processOverpassElements } from '../utils/streetProcessor';
import { 
  createFeatureFromPresetAreaShape, 
  convertLatLngToPosition 
} from '../utils/geometryUtils';
import { PresetAreaShape, Difficulty, defaults } from '../utils/areaTypes';

/**
 * Hook for fetching and processing street data from Overpass API
 * This replaces the old server-side approach with client-side fetching
 */
export function useOverpassStreets({
  center = { lat: 35.0844, lng: -106.6504 }, // Albuquerque
  radius = defaults.radius,
  shape = defaults.shape,
  difficulty = defaults.difficulty,
  numberOfQuestions = 10
} = {}) {
  const [streets, setStreets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadStreets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Loading streets from Overpass API...');
      console.log('  Center:', center);
      console.log('  Radius:', radius, 'meters');
      console.log('  Shape:', shape);
      console.log('  Difficulty:', difficulty);
      
      // Create area selection
      const centerPosition = convertLatLngToPosition(center);
      const feature = createFeatureFromPresetAreaShape(shape, centerPosition, radius);
      
      const areaSelection = {
        areaId: null,
        feature,
        presetShape: shape,
        radius
      };
      
      // Fetch from Overpass API
      const overpassResponse = await fetchOverpassData({ 
        areaSelection,
        shouldCacheResponseInBrowser: true 
      });
      
      if (!overpassResponse.elements || overpassResponse.elements.length === 0) {
        throw new Error('No streets found in this area');
      }
      
      // Process and filter elements
      const processedStreets = processOverpassElements({
        elements: overpassResponse.elements,
        difficulty,
        numberOfQuestions
      });
      
      if (processedStreets.length === 0) {
        throw new Error(
          'No suitable streets found. Try increasing the difficulty or selecting a different area.'
        );
      }
      
      setStreets(processedStreets);
      console.log(`✅ Loaded ${processedStreets.length} streets`);
      
    } catch (err) {
      console.error('❌ Error loading streets:', err);
      setError(err.message);
      setStreets([]);
    } finally {
      setLoading(false);
    }
  }, [center, radius, shape, difficulty, numberOfQuestions]);
  
  const refreshStreets = useCallback(() => {
    loadStreets();
  }, [loadStreets]);
  
  return { 
    streets, 
    loading, 
    error, 
    loadStreets,
    refreshStreets 
  };
}
