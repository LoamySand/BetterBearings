import { useRef, useEffect } from 'react';

/**
 * Custom hook to manage street polylines on the map
 */
export function useStreetPolylines({
  streets,
  quizCenter,
  mapRef,
  mapInstanceRef,
  isMapReady,
  gameActiveRef,
  currentStreetRef,
  gameOverRef,
  roundRef,
  totalRounds,
  setScore,
  setFeedback,
  setGameActive,
  setRound,
  startNewRound,
  endGame,
}) {
  const polylinesRef = useRef({});

  // Draw streets on map once it's initialized
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef || !mapInstanceRef.current || !streets || streets.length === 0 || !quizCenter) {
      console.log('Polylines init check:', {
        isMapReady,
        hasMapInstanceRef: !!mapInstanceRef,
        hasMapInstance: !!(mapInstanceRef && mapInstanceRef.current),
        streetsCount: streets?.length || 0,
        hasQuizCenter: !!quizCenter,
      });
      return;
    }

    console.log('✅ All conditions met, will draw streets in 200ms');

    // Wait a bit for map to be fully ready
    const timer = setTimeout(() => {
      console.log('⏰ Timer fired, calling drawStreets now');
      drawStreets();
    }, 200);

    function drawStreets() {
      if (!mapInstanceRef || !mapInstanceRef.current || !streets || streets.length === 0) {
        console.error('❌ Cannot draw streets - map not ready');
        return;
      }

      console.log('=== DRAWING STREETS ON MAP ===');
      console.log('Streets to draw:', streets.length);
      console.log('Map instance:', mapInstanceRef.current);

      const map = mapInstanceRef.current;
      
      // Clear existing polylines first
      Object.values(polylinesRef.current).forEach((polylineArray) => {
        if (Array.isArray(polylineArray)) {
          polylineArray.forEach((polyline) => {
            if (polyline && polyline.remove) {
              polyline.remove();
            }
          });
        }
      });
      polylinesRef.current = {};

      // Define event handlers
      const handleStreetClick = (e, street) => {
        window.L.DomEvent.stopPropagation(e);
        console.log('=== STREET CLICKED ===');
        console.log('Clicked:', street.name);
        console.log('Target:', currentStreetRef.current?.name);

        // Do nothing if game is over or not active
        if (gameOverRef.current || !currentStreetRef.current || !gameActiveRef.current) {
          console.log('Click ignored - game not active');
          return;
        }

        // Compare by name
        const clickedName = street.name.toLowerCase();
        const currentName = currentStreetRef.current.name.toLowerCase();
        const isCorrect = clickedName === currentName;

        // Visual feedback - flash ALL segments of the clicked street
        const allSegments = polylinesRef.current[street.name];
        if (allSegments) {
          allSegments.forEach(segment => {
            segment.setStyle({
              color: isCorrect ? '#10B981' : '#EF4444',
              weight: 6,
              opacity: 1,
            });
          });
        }

        if (isCorrect) {
          setScore((prevScore) => prevScore + 10);
          setFeedback('🎉 Correct! +10 points');
          console.log('✓ CORRECT!');
        } else {
          setFeedback(
            `❌ Wrong! That was ${street.name}, not ${currentStreetRef.current.name}`
          );
          console.log('✗ INCORRECT');
        }

        // Prevent clicks in between rounds for 2 seconds and reset color
        setGameActive(false);

        setTimeout(() => {
          // Reset ALL segments of this street back to blue
          if (allSegments) {
            allSegments.forEach(segment => {
              segment.setStyle({
                color: '#3B82F6',
                weight: 4,
                opacity: 0.7,
              });
            });
          }

          if (roundRef.current < totalRounds) {
            setRound((prevRound) => prevRound + 1);
            startNewRound();
          } else {
            endGame();
          }
        }, 2000);
      };

      const handleStreetHover = (streetName, isHovering) => {
        const allSegments = polylinesRef.current[streetName];
        if (allSegments) {
          allSegments.forEach(segment => {
            if (isHovering) {
              segment.setStyle({ color: "#f1ee30ff", weight: 6, opacity: 0.9 });
            } else {
              segment.setStyle({
                color: '#3B82F6',
                weight: 4,
                opacity: 0.7,
              });
            }
          });
        }
      };

      let totalPolylinesDrawn = 0;

    // Draw all streets
    streets.forEach((street, streetIndex) => {
      console.log(`\nStreet ${streetIndex + 1}: ${street.name}`);
      console.log(`  Polylines: ${street.points?.length || 0}`);

      if (street.points && street.points.length > 0) {
        street.points.forEach((polylinePoints, polylineIndex) => {
          console.log(
            `  Drawing polyline ${polylineIndex + 1}/${street.points.length} with ${polylinePoints.length} points`
          );

          // Convert {lat, lng} objects to [lat, lng] arrays for Leaflet
          const leafletCoords = polylinePoints.map(point => [point.lat, point.lng]);

          const polyline = window.L.polyline(leafletCoords, {
            color: '#3B82F6',
            weight: street.isEnclosedArea ? 3 : 4,
            opacity: 0.7,
            className: 'clickable-street',
            fillColor: street.isEnclosedArea ? '#3B82F6' : undefined,
            fillOpacity: street.isEnclosedArea ? 0.1 : undefined
          }).addTo(map);

          polyline.streetId = street.name;
          polyline.streetName = street.name;

          // Click handler
          polyline.on('click', (e) => {
            handleStreetClick(e, street);
          });

          // Hover effects
          polyline.on('mouseover', function () {
            handleStreetHover(street.name, true);
          });

          polyline.on('mouseout', function () {
            handleStreetHover(street.name, false);
          });

          // Store polyline references
          if (!polylinesRef.current[street.name]) {
            polylinesRef.current[street.name] = [];
          }
          polylinesRef.current[street.name].push(polyline);

          totalPolylinesDrawn++;
        });
      }
    });

    console.log(`\n✅ Streets drawn!`);
    console.log(`   Total streets: ${streets.length}`);
    console.log(`   Total polylines drawn: ${totalPolylinesDrawn}`);

    // Start the first round after drawing streets
    if (startNewRound) {
      setTimeout(() => {
        console.log('🎮 Starting first round...');
        startNewRound();
      }, 100);
    }
  }

    return () => clearTimeout(timer);
  }, [streets, quizCenter, isMapReady, mapInstanceRef, setScore, setFeedback, setGameActive, setRound, startNewRound, endGame, gameActiveRef, currentStreetRef, gameOverRef, roundRef, totalRounds]);

  const resetPolylineColors = () => {
    Object.values(polylinesRef.current).forEach((polylineArray) => {
      if (Array.isArray(polylineArray)) {
        polylineArray.forEach((polyline) => {
          if (polyline && polyline.setStyle) {
            polyline.setStyle({
              color: '#3B82F6',
              weight: 4,
              opacity: 0.7,
            });
          }
        });
      }
    });
  };

  const clearPolylines = () => {
    Object.values(polylinesRef.current).forEach((polylineArray) => {
      if (Array.isArray(polylineArray)) {
        polylineArray.forEach((polyline) => {
          if (polyline && polyline.remove) {
            polyline.remove();
          }
        });
      }
    });
    polylinesRef.current = {};
  };

  return {
    polylinesRef,
    resetPolylineColors,
    clearPolylines,
  };
}
