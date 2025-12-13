import { useState, useEffect, useRef } from 'react';
import { Trophy, Target, Star, Award, RefreshCw } from 'lucide-react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';
import './BackOfYourHand.css';

export default function StreetFinderGame() {
  // Game mode: 'selecting' | 'playing' | 'gameOver'
  const [gameMode, setGameMode] = useState('selecting');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStreet, setCurrentStreet] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [totalRounds] = useState(5);
  const [finalScore, setFinalScore] = useState(0);
  
  // Quiz area settings - will be set when user clicks "Quiz this Area"
  const [quizCenter, setQuizCenter] = useState(null);
  const [quizRadius, setQuizRadius] = useState(5000); // 5km default
  const [difficulty] = useState(Difficulty.Tourist);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const mapInitialized = useRef(false);
  const selectionMapInitialized = useRef(false);

  const gameActiveRef = useRef(false);
  const currentStreetRef = useRef(null);
  const gameOverRef = useRef(false);
  const roundRef = useRef(1);

  // Load streets from Overpass API - only when quizCenter is set
  const { streets, loading, error, loadStreets } = useOverpassStreets({
    center: quizCenter,
    radius: quizRadius,
    shape: PresetAreaShape.Circle,
    difficulty,
    numberOfQuestions: 20  // Reduced from 50 to stay under localStorage quota
  });
  
  const streetsRef = useRef([]);
  const usedStreetIndices = useRef(new Set());

  // Load streets when quiz area is selected (only on initial load)
  const streetsLoadedForCenter = useRef(null);
  
  useEffect(() => {
    // Only load if we don't have streets for this center yet
    const centerKey = quizCenter ? `${quizCenter.lat},${quizCenter.lng}` : null;
    
    if (quizCenter && gameMode === 'playing' && streetsLoadedForCenter.current !== centerKey) {
      loadStreets();
      streetsLoadedForCenter.current = centerKey;
    }
  }, [quizCenter, gameMode, loadStreets]);

  // Update streets ref when streets change
  useEffect(() => {
    if (streets && streets.length > 0) {
      streetsRef.current = streets;
      usedStreetIndices.current.clear();
      console.log('Streets loaded:', streets.length);
    }
  }, [streets]);

  // Sync refs with state
  useEffect(() => {
    gameActiveRef.current = gameActive;
  }, [gameActive]);

  useEffect(() => {
    currentStreetRef.current = currentStreet;
  }, [currentStreet]);

  useEffect(() => {
    gameOverRef.current = gameMode === 'gameOver';
  }, [gameMode]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

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
            // This shouldn't happen, but if it does, we'd need to recreate the map
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

  // Initialize map once streets are loaded
  useEffect(() => {
    if (mapInitialized.current || !streetsRef.current.length) {
      console.log('Map init check:', {
        initialized: mapInitialized.current,
        streetsCount: streetsRef.current.length,
      });
      return;
    }

    let checkInterval;

    const initMap = () => {
        //Check if leaflet has loaded TODO make sure it is either bundled or a dependancy 
      if (!window.L || !mapRef.current) {
        return;
      }

      if (checkInterval) {
        clearInterval(checkInterval);
      }

      console.log('=== INITIALIZING MAP ===');
      console.log('Streets to draw:', streetsRef.current.length);

      try {
        const map = window.L.map(mapRef.current, {
          center: [quizCenter.lat, quizCenter.lng],
          zoom: 11.5,
          zoomControl: true,
        });

        // Add OpenStreetMap tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        console.log('Map created, adding streets...');

        let totalPolylinesDrawn = 0;

        // Draw all streets - now using points array from Overpass data
        streetsRef.current.forEach((street, streetIndex) => {
          console.log(`\nStreet ${streetIndex + 1}: ${street.name}`);
          console.log(`  Polylines: ${street.points?.length || 0}`);

          // street.points is array of polylines (array of LatLng objects)
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

              // Use street name as ID since Overpass streets don't have IDs
              polyline.streetId = street.name;
              polyline.streetName = street.name;

              // Click handler
              polyline.on('click', (e) => {
                window.L.DomEvent.stopPropagation(e);
                console.log('=== STREET CLICKED ===');
                console.log('Clicked:', street.name);
                console.log('Target:', currentStreetRef.current?.name);

                //Do nothing if game is over or not active
                if (gameOverRef.current || !currentStreetRef.current || !gameActiveRef.current) {
                  return;
                }

                // Compare by name instead of ID
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
              });

              // Hover effects, highlight ALL segments of this street while hovering
              polyline.on('mouseover', function () {
              
                  // Highlight all segments with the same street name
                  const allSegments = polylinesRef.current[street.name];
                  if (allSegments) {
                    allSegments.forEach(segment => {
                      segment.setStyle({color: "#f1ee30ff", weight: 6, opacity: 0.9 });
                    });
                  }
                }
              );

              polyline.on('mouseout', function () {
                // Reset all segments with the same street name back to blue
                const allSegments = polylinesRef.current[street.name];
                if (allSegments) {
                  allSegments.forEach(segment => {
                    segment.setStyle({
                      color: '#3B82F6',
                      weight: 4,
                      opacity: 0.7,
                    });
                  });
                }
              });

              // Store polyline references so we can reset / style them later
              if (!polylinesRef.current[street.name]) {
                polylinesRef.current[street.name] = [];
              }
              polylinesRef.current[street.name].push(polyline);

              totalPolylinesDrawn++;
            });
          }
        });
        // TODO lock behind debug flag
        console.log(`\n✅ Map initialized!`);
        console.log(`   Total streets: ${streetsRef.current.length}`);
        console.log(`   Total polylines drawn: ${totalPolylinesDrawn}`);

        mapInstanceRef.current = map;
        mapInitialized.current = true;

        // Use whenReady to ensure map is fully loaded before proceeding
        map.whenReady(() => {
          console.log('Map is ready and rendered');

          try {
            map.invalidateSize();
          } catch (err) {
            console.warn('Could not invalidate size:', err.message);
          }

          // Start the first round
          startNewRound();
        });
      } catch (error) {
        console.error('❌ Error creating map:', error);
      }
    };

    // Try to initialize, if leaflet is unavailable, try at each interval
    initMap();

    checkInterval = setInterval(() => {
      if (!mapInitialized.current) {
        initMap();
      } else {
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Cleanup only on unmount
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [streets]); // Only depends on streets
  
  // Separate cleanup for unmount only
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitialized.current = false;
      }
    };
  }, []); // Empty deps - only runs on unmount

  const getRandomStreet = () => {
    if (streetsRef.current.length === 0) return null;

    // If we've used all streets, reset
    if (usedStreetIndices.current.size >= streetsRef.current.length) {
      usedStreetIndices.current.clear();
    }

    // Find unused street
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * streetsRef.current.length);
    } while (usedStreetIndices.current.has(randomIndex));

    usedStreetIndices.current.add(randomIndex);
    return streetsRef.current[randomIndex];
  };

  const startNewRound = () => {
    const newStreet = getRandomStreet();
    if (!newStreet) {
      console.error('No streets available');
      return;
    }

    console.log('=== NEW ROUND ===');
    console.log('New street:', newStreet.name);
    setCurrentStreet(newStreet);
    setGameActive(true);
    setFeedback('');
  };

  // End game: set flags and snapshot final score
  const endGame = () => {
    setGameMode('gameOver');
    setFinalScore(score);
    setGameActive(false);
  };

  // Initialize selection map (before quiz starts)
  useEffect(() => {
    if (gameMode !== 'selecting' || selectionMapInitialized.current) {
      return;
    }

    let checkInterval;

    const initSelectionMap = () => {
      if (!window.L || !mapRef.current) {
        console.log('Waiting for Leaflet or map container...', { 
          leaflet: !!window.L, 
          mapRef: !!mapRef.current 
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
          // Container already has a map, need to clear it
          return;
        }

        const map = window.L.map(container, {
          center: [35.0844, -106.6504], // Default to Albuquerque
          zoom: 11.5,
          zoomControl: true,
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
  }, [gameMode]);

  // Handle "Quiz this Area" button click
  const handleQuizThisArea = () => {
    if (!mapInstanceRef.current) {
      console.error('Map not initialized');
      return;
    }

    const map = mapInstanceRef.current;
    const center = map.getCenter();
    const bounds = map.getBounds();
    
    // Calculate radius from bounds (approximate)
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const radiusMeters = Math.round(center.distanceTo(ne));

    console.log('Quiz area selected:', { center, radiusMeters });

    // Remove the selection map before transitioning
    map.remove();
    mapInstanceRef.current = null;
    selectionMapInitialized.current = false;

    setQuizCenter({ lat: center.lat, lng: center.lng });
    setQuizRadius(radiusMeters);
    setGameMode('playing');
  };

  // Play same area again
  const playSameArea = () => {
    setScore(0);
    setRound(1);
    setFinalScore(0);
    setFeedback('');
    
    roundRef.current = 1;
    gameOverRef.current = false;
    
    usedStreetIndices.current.clear();

    // Reset all polylines to blue
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

    // Get new street and start playing
    const newStreet = getRandomStreet();
    if (newStreet) {
      setCurrentStreet(newStreet);
      setGameActive(true);
    }
    
    // Change game mode - this will trigger the useEffect that invalidates map size
    setGameMode('playing');
  };

  // Choose new area
  const chooseNewArea = () => {
    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    
    mapInitialized.current = false;
    selectionMapInitialized.current = false;
    polylinesRef.current = {};
    streetsRef.current = [];
    usedStreetIndices.current.clear();
    
    setScore(0);
    setRound(1);
    setFinalScore(0);
    setFeedback('');
    setCurrentStreet(null);
    setQuizCenter(null);
    setGameMode('selecting');
    
    roundRef.current = 1;
    gameOverRef.current = false;
  };

  // Show loading state only when in playing mode
  if (gameMode === 'playing' && loading) {
    return (
      <div className="game-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <RefreshCw size={48} className="animate-spin" />
          <p>Loading streets from Overpass API...</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            This may take 10-30 seconds on first load. Results will be cached.
          </p>
        </div>
      </div>
    );
  }

  // Show error state only when in playing mode
  if (gameMode === 'playing' && error) {
    return (
      <div className="game-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '1rem',
            padding: '2rem',
          }}
          //TODDO Guarentee that user selects a small enough area
        >
          <h1 style={{ color: '#EF4444' }}>Error loading streets, Try a smaller area </h1>
          <p style={{ color: '#EF4444' }}>Error: {error}</p>
          <button onClick={loadStreets} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show error only when in playing mode
  if (gameMode === 'playing' && streets.length === 0 && !loading) {
    return (
      <div className="game-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            No streets found in this area
          </p>
          <p style={{ color: '#6b7280' }}>Try a different area or zoom level</p>
          <button
            onClick={chooseNewArea}
            style={{
              padding: '1rem 2rem',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Choose Different Area
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-info">
          <h1 className="game-title">
            <Target size={32} />
            Back Of Your Hand
          </h1>
          {gameMode !== 'selecting' && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {difficulty === Difficulty.Tourist && 'Difficulty: Tourist (Major roads)'}
              {difficulty === Difficulty.Resident && 'Difficulty: Resident (+ Tertiary roads)'}
              {difficulty === Difficulty.TaxiDriver && 'Difficulty: Taxi Driver (All roads)'}
              {quizRadius && ` • ${Math.round(quizRadius / 1000)}km radius`}
            </div>
          )}

          {gameMode === 'playing' && (
            <div className="game-stats">
              <div className="stat">
                <Star size={20} />
                <span>Score: {score}</span>
              </div>
              <div className="stat">
                <Trophy size={20} />
                <span>
                  Round: {round}/{totalRounds}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="game-content">
        {gameMode === 'selecting' && (
          <div className="quiz-button-overlay">
            <button onClick={handleQuizThisArea} className="btn-quiz-area">
              📍 Quiz This Area
            </button>
            <p className="quiz-instruction">Pan and zoom the map to select your quiz area</p>
          </div>
        )}

        {gameMode === 'playing' && (
          <div className="question-panel">
            {currentStreet ? (
              <>
                <h2 className="question">Find this street:</h2>
                <h3 className="street-name">{currentStreet.name}</h3>
                {feedback && (
                  <div
                    className={`feedback ${feedback.includes('Correct') ? 'correct' : 'incorrect'}`}
                  >
                    {feedback}
                  </div>
                )}
                <p className="instruction">
                  {gameActive ? 'Click on the street on the map below' : 'Wait for next round...'}
                </p>
              </>
            ) : (
              <p>Loading...</p>
            )}
          </div>
        )}

        <div className="map-wrapper">
          <div
            ref={mapRef}
            style={{
              height: '100%',
              width: '100%',
              minHeight: '500px',
            }}
          />
        </div>
      </div>

      {gameMode === 'gameOver' && (
        <div className="game-over" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }}>
          <div className="game-over-content">
            <Award size={64} className="trophy-icon" />
            <h2>Game Over!</h2>
            <div className="final-score">
              <p>Final Score</p>
              <h1>{finalScore}</h1>
              <p className="score-message">
                {finalScore >= 40
                  ? 'Impressive!'
                  : finalScore >= 25
                    ? 'Good Try!!'
                    : 'Keep practicing!'}
              </p>
            </div>
            <div className="game-over-buttons">
              <button onClick={playSameArea} className="btn-restart">
                🔄 Play Same Area
              </button>
              <button onClick={chooseNewArea} className="btn-restart btn-secondary">
                🗺️ Choose New Area
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
