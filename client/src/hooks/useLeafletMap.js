import { useRef, useEffect } from 'react';

/**
 * Custom hook to manage Leaflet map initialization and lifecycle
 */
export function useLeafletMap({ 
  gameMode, 
  quizCenter, 
  mapType = 'playing', // 'playing' or 'selecting'
  mapRef, // Pass in the ref from the component
}) {
  const mapInstanceRef = useRef(null);
  const mapInitialized = useRef(false);
  const selectionMapInitialized = useRef(false);

  // Initialize selection map (before quiz starts)
  useEffect(() => {
    // Reset initialization flag when switching back to selecting mode
    if (gameMode !== 'selecting' && selectionMapInitialized.current) {
      selectionMapInitialized.current = false;
    }

    if (mapType !== 'selecting' || gameMode !== 'selecting' || selectionMapInitialized.current) {
      return;
    }

    let checkInterval;

    const initSelectionMap = () => {
      if (!window.L || !mapRef || !mapRef.current) {
        console.log('Waiting for Leaflet or map container...', { 
          leaflet: !!window.L, 
          mapRef: !!mapRef,
          mapRefCurrent: !!(mapRef && mapRef.current)
        });
        return;
      }

      if (checkInterval) {
        clearInterval(checkInterval);
      }

      console.log('=== INITIALIZING SELECTION MAP ===');

      try {
        // Ensure container is not already initialized
        const container = mapRef.current;
        if (container._leaflet_id) {
          console.log('Map container already has Leaflet instance, clearing...');
          return;
        }

        const map = window.L.map(container, {
          center: [35.0844, -106.6504], // Default to Albuquerque
          zoom: 11.5,
          zoomControl: true,
        });

        window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        mapInstanceRef.current = map;
        selectionMapInitialized.current = true;

        console.log('✅ Selection map initialized');
        
        // Ensure map renders properly
        setTimeout(() => {
          if (map) {
            map.invalidateSize();
          }
        }, 100);
      } catch (error) {
        console.error('❌ Error creating selection map:', error);
      }
    };

    // Small delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      initSelectionMap();

      checkInterval = setInterval(() => {
        if (!selectionMapInitialized.current) {
          initSelectionMap();
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
  }, [gameMode, mapType, mapRef]);

  // Handle map visibility when transitioning from gameOver back to playing
  useEffect(() => {
    console.log('Map visibility effect triggered:', {
      gameMode,
      hasMapInstance: !!mapInstanceRef.current,
      mapInitialized: mapInitialized.current,
      hasMapRef: !!mapRef.current
    });
    
    if (gameMode === 'playing' && mapInstanceRef.current && mapInitialized.current) {
      console.log('Game mode changed to playing, refreshing map');
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        const mapDiv = mapRef.current;
        const mapInstance = mapInstanceRef.current;
        
        console.log('Attempting to refresh map:', {
          hasMapDiv: !!mapDiv,
          hasMapInstance: !!mapInstance
        });
        
        if (!mapDiv || !mapInstance) {
          console.error('Map div or instance missing', {
            mapDiv: !!mapDiv,
            mapInstance: !!mapInstance
          });
          return;
        }
        
        try {
          // Check if map is properly attached to container
          const container = mapInstance.getContainer();
          console.log('Map container check:', {
            divExists: !!mapDiv,
            containerExists: !!container,
            sameElement: container === mapDiv,
            divHasLeafletId: !!mapDiv._leaflet_id
          });
          
          // If container is not the current div, we need to reinitialize
          if (container !== mapDiv) {
            console.warn('Map container mismatch, need to reinitialize');
            return;
          }
          
          mapInstance.invalidateSize();
          // Also pan to center to ensure tiles load
          if (quizCenter) {
            mapInstance.setView([quizCenter.lat, quizCenter.lng], 11.5);
          }
          console.log('Map size invalidated and view reset');
        } catch (e) {
          console.error('Error refreshing map:', e);
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [gameMode, quizCenter]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Map already removed:', e);
        }
        mapInstanceRef.current = null;
        mapInitialized.current = false;
      }
    };
  }, []);

  const removeSelectionMap = () => {
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('Map already removed in removeSelectionMap:', e);
      }
      mapInstanceRef.current = null;
      selectionMapInitialized.current = false;
    }
  };

  const cleanupMap = () => {
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('Map already removed in cleanupMap:', e);
      }
      mapInstanceRef.current = null;
    }
    mapInitialized.current = false;
    selectionMapInitialized.current = false;
  };

  return {
    mapInstanceRef,
    mapInitialized,
    selectionMapInitialized,
    removeSelectionMap,
    cleanupMap,
  };
}
