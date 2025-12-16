import { useRef, useEffect, useState } from 'react';

/**
 * Custom hook to initialize the playing map (map with tile layer for the game)
 */
export function usePlayingMap({ 
  gameMode, 
  quizCenter, 
  streets,
  mapRef,
}) {
  const mapInstanceRef = useRef(null);
  const mapInitialized = useRef(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Initialize playing map when we have streets and quiz center
  useEffect(() => {
    // Clean up if switching away from playing mode
    if (gameMode !== 'playing') {
      if (mapInstanceRef.current) {
        console.log('Cleaning up playing map (not in playing mode)');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitialized.current = false;
        setIsMapReady(false);
      }
      return;
    }

    if (mapInitialized.current || !quizCenter || !streets || streets.length === 0) {
      return;
    }

    let checkInterval;

    const initPlayingMap = () => {
      if (!window.L || !mapRef.current) {
        console.log('Waiting for Leaflet or map container for playing map...', { 
          leaflet: !!window.L, 
          mapRef: !!mapRef.current 
        });
        return;
      }

      if (checkInterval) {
        clearInterval(checkInterval);
      }

      console.log('=== INITIALIZING PLAYING MAP ===');

      try {
        // Ensure container is not already initialized
        const container = mapRef.current;
        if (container._leaflet_id) {
          console.log('Map container already has Leaflet instance, skipping...');
          return;
        }

        const map = window.L.map(container, {
          center: [quizCenter.lat, quizCenter.lng],
          zoom: 11.5,
          zoomControl: true,
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        mapInstanceRef.current = map;
        mapInitialized.current = true;
        setIsMapReady(true); // Trigger re-render

        console.log('✅ Playing map initialized');
        
        // Ensure map renders properly
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
          }
        }, 100);
      } catch (error) {
        console.error('❌ Error creating playing map:', error);
      }
    };

    // Small delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      initPlayingMap();

      checkInterval = setInterval(() => {
        if (!mapInitialized.current) {
          initPlayingMap();
        } else {
          clearInterval(checkInterval);
        }
      }, 100);
    }, 50);

    return () => {
      if (initialTimeout) {
        clearTimeout(initialTimeout);
      }
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [gameMode, quizCenter, streets, mapRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitialized.current = false;
        setIsMapReady(false);
      }
    };
  }, []);

  const cleanupMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    mapInitialized.current = false;
    setIsMapReady(false);
  };

  return {
    mapInstanceRef,
    mapInitialized,
    isMapReady,
    cleanupMap,
  };
}
