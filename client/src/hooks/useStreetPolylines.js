import { useRef, useEffect, useCallback } from 'react';
import { MAP_COLORS } from '../utils/mapColors';

// Street colors (KAN-81: ink at rest, yellow for the one in focus, green and red for results).
// Each polyline keeps its own resting weight (areas are drawn thinner).
const PAINT = {
  hover: { color: MAP_COLORS.hover, opacity: 1, extraWeight: 2 },
  highlight: { color: MAP_COLORS.highlight, opacity: 1, extraWeight: 4 },
  correct: { color: MAP_COLORS.correct, opacity: 1, extraWeight: 2 },
  wrong: { color: MAP_COLORS.wrong, opacity: 1, extraWeight: 2 },
};
const BASE_COLOR = MAP_COLORS.street;
const BASE_OPACITY = 0.7;
// How long the result colors stay before the next round
const RESULT_MS = 2000;
// A mouse or trackpad as the main pointer. Phones and tablets without one don't match.
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

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
  const firstRoundStartedRef = useRef(false);
  // The street the keyboard has highlighted (useKeyboardPlay), so hover-out restores it
  const highlightedRef = useRef(null);
  // Set while drawStreets has run: resolves a guess for clicks, Enter and Skip alike
  const resolveRef = useRef(null);

  // Paints every segment of one street. 'base' restores the resting style.
  const paint = useCallback((name, kind) => {
    const segments = polylinesRef.current[name];
    if (!segments) return;
    segments.forEach((segment) => {
      const weight = segment.baseWeight ?? 6;
      if (kind === 'base') {
        segment.setStyle({ color: BASE_COLOR, weight, opacity: BASE_OPACITY });
        return;
      }
      const { extraWeight = 0, ...style } = PAINT[kind];
      segment.setStyle({ ...style, weight: weight + extraWeight });
      segment.bringToFront();
    });
  }, []);

  // Draw streets on map once it's initialized
  useEffect(() => {
    if (
      !isMapReady ||
      !mapInstanceRef ||
      !mapInstanceRef.current ||
      !streets ||
      streets.length === 0 ||
      !quizCenter
    ) {
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

      // One path for a click, Enter on a highlighted street, and Skip (street = null).
      // A wrong guess or a skip shows the right street in green before the next round (KAN-64).
      const resolveGuess = (street) => {
        if (gameOverRef.current || !currentStreetRef.current || !gameActiveRef.current) {
          return;
        }
        const answer = currentStreetRef.current;
        const isCorrect = !!street && street.name.toLowerCase() === answer.name.toLowerCase();

        if (highlightedRef.current) {
          paint(highlightedRef.current, 'base');
          highlightedRef.current = null;
        }

        if (isCorrect) {
          paint(street.name, 'correct');
          setScore((prevScore) => prevScore + 10);
          setFeedback('🎉 Correct! +10 points');
        } else {
          if (street) paint(street.name, 'wrong');
          paint(answer.name, 'correct');
          revealOnMap(answer.name);
          setFeedback(street ? `❌ Wrong! That was ${street.name}.` : '⏭️ Skipped.');
        }

        // No guesses while the result shows
        setGameActive(false);

        setTimeout(() => {
          if (street) paint(street.name, 'base');
          paint(answer.name, 'base');

          if (roundRef.current < totalRounds) {
            setRound((prevRound) => prevRound + 1);
            startNewRound();
          } else {
            endGame();
          }
        }, RESULT_MS);
      };
      resolveRef.current = resolveGuess;

      // Pans to the answer when none of it is on screen
      const revealOnMap = (name) => {
        const segments = polylinesRef.current[name];
        if (!segments?.length) return;
        // A fresh bounds object: extend() changes it in place, and getBounds() is the polyline's own
        const bounds = segments.reduce(
          (b, seg) => b.extend(seg.getBounds()),
          window.L.latLngBounds([])
        );
        if (!map.getBounds().intersects(bounds)) map.panTo(bounds.getCenter());
      };

      const handleStreetClick = (e, street) => {
        window.L.DomEvent.stopPropagation(e);
        resolveGuess(street);
      };

      // Hover only while a round is live, so it can't repaint a result
      const handleStreetHover = (streetName, isHovering) => {
        if (!gameActiveRef.current) return;
        if (isHovering) paint(streetName, 'hover');
        else paint(streetName, highlightedRef.current === streetName ? 'highlight' : 'base');
      };

      const canHover = window.matchMedia(HOVER_QUERY).matches;

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
            const leafletCoords = polylinePoints.map((point) => [point.lat, point.lng]);

            const polyline = window.L.polyline(leafletCoords, {
              color: BASE_COLOR,
              weight: street.isEnclosedArea ? 3 : 6,
              opacity: BASE_OPACITY,
              className: 'clickable-street',
              fillColor: street.isEnclosedArea ? BASE_COLOR : undefined,
              fillOpacity: street.isEnclosedArea ? 0.1 : undefined,
            }).addTo(map);

            polyline.streetId = street.name;
            polyline.streetName = street.name;
            polyline.street = street;
            polyline.baseWeight = street.isEnclosedArea ? 3 : 6;

            // Click handler
            polyline.on('click', (e) => {
              handleStreetClick(e, street);
            });

            // Hover effects, only where there is a real hover. On a touch screen a tap also fires
            // mouseover, and paint() moves the path in the DOM (bringToFront). iOS Safari treats a
            // DOM change during mouseover as a hover tap and drops the click, so the street turned
            // yellow and the guess never counted.
            if (canHover) {
              polyline.on('mouseover', function () {
                handleStreetHover(street.name, true);
              });

              polyline.on('mouseout', function () {
                handleStreetHover(street.name, false);
              });
            }

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

      // Start the first round after drawing streets (only once)
      if (startNewRound && !firstRoundStartedRef.current) {
        firstRoundStartedRef.current = true;
        setTimeout(() => {
          console.log('🎮 Starting first round...');
          startNewRound();
        }, 100);
      }
    }

    return () => clearTimeout(timer);
  }, [
    streets,
    quizCenter,
    isMapReady,
    mapInstanceRef,
    setScore,
    setFeedback,
    setGameActive,
    setRound,
    startNewRound,
    endGame,
    gameActiveRef,
    currentStreetRef,
    gameOverRef,
    roundRef,
    totalRounds,
    paint,
  ]);

  const resetPolylineColors = () => {
    highlightedRef.current = null;
    Object.keys(polylinesRef.current).forEach((name) => paint(name, 'base'));
  };

  // For keyboard play: guess a street by name, skip, and move the highlight
  const guess = useCallback((name) => {
    const street = polylinesRef.current[name]?.[0]?.street;
    if (street) resolveRef.current?.(street);
  }, []);
  const skip = useCallback(() => resolveRef.current?.(null), []);
  const setHighlight = useCallback(
    (name) => {
      if (highlightedRef.current && highlightedRef.current !== name) {
        paint(highlightedRef.current, 'base');
      }
      highlightedRef.current = name;
      if (name) paint(name, 'highlight');
    },
    [paint]
  );

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
    highlightedRef.current = null;
    resolveRef.current = null;
    firstRoundStartedRef.current = false; // Reset so next round can start
  };

  return {
    polylinesRef,
    resetPolylineColors,
    clearPolylines,
    guess,
    skip,
    setHighlight,
  };
}
