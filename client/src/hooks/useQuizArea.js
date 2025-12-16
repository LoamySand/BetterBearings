import { useState, useCallback } from 'react';

/**
 * Custom hook to manage quiz area selection
 */
export function useQuizArea() {
  const [quizCenter, setQuizCenter] = useState(null);
  const [quizRadius, setQuizRadius] = useState(5000); // 5km default

  const handleQuizThisArea = useCallback((mapInstance, onAreaSelected) => {
    if (!mapInstance) {
      console.error('Map not initialized');
      return;
    }

    const map = mapInstance;
    const center = map.getCenter();
    const bounds = map.getBounds();
    
    // Calculate radius from bounds (approximate)
    const ne = bounds.getNorthEast();
    const radiusMeters = Math.round(center.distanceTo(ne));

    console.log('Quiz area selected:', { center, radiusMeters });

    const quizData = {
      center: { lat: center.lat, lng: center.lng },
      radius: radiusMeters,
    };

    setQuizCenter(quizData.center);
    setQuizRadius(quizData.radius);

    // Call callback to handle map cleanup and mode transition
    if (onAreaSelected) {
      onAreaSelected(quizData);
    }

    return quizData;
  }, []);

  const resetQuizArea = useCallback(() => {
    setQuizCenter(null);
    setQuizRadius(5000);
  }, []);

  return {
    quizCenter,
    quizRadius,
    setQuizCenter,
    setQuizRadius,
    handleQuizThisArea,
    resetQuizArea,
  };
}
