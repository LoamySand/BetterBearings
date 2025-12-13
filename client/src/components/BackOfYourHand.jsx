import { useState, useEffect, useRef } from 'react';
import { Trophy, Target, Star, Award, RefreshCw } from 'lucide-react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';
import './BackOfYourHand.css';

export default function StreetFinderGame() {
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStreet, setCurrentStreet] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [totalRounds] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  // Overpass settings
  const [center] = useState({ lat: 35.0844, lng: -106.6504 }); // Albuquerque
  const [radius] = useState(5000); // 5km radius
  const [difficulty] = useState(Difficulty.Tourist);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const mapInitialized = useRef(false);

  const gameActiveRef = useRef(false);
  const currentStreetRef = useRef(null);
  const gameOverRef = useRef(false);

  // Load streets from Overpass API
  const { streets, loading, error, loadStreets } = useOverpassStreets({
    center,
    radius,
    shape: PresetAreaShape.Circle,
    difficulty,
    numberOfQuestions: 20
  });
  
  const streetsRef = useRef([]);
  const usedStreetIndices = useRef(new Set());

  // Convert center back to [lat, lng] array for Leaflet
  const centerArray = [center.lat, center.lng];

  // Load streets on mount
  useEffect(() => {
    loadStreets();
  }, [loadStreets]);

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
    gameOverRef.current = gameOver;
  }, [gameOver]);

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

      // TODO lock behind debug flag
      console.log('=== INITIALIZING MAP ===');
      console.log('Streets to draw:', streetsRef.current.length);

      try {
        const map = window.L.map(mapRef.current, {
          center: centerArray,
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

                // Visual feedback - flash the clicked street
                polyline.setStyle({
                  color: isCorrect ? '#10B981' : '#EF4444',
                  weight: 6,
                  opacity: 1,
                });

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
                  // Reset color back to blue
                  polyline.setStyle({
                    color: '#3B82F6',
                    weight: 4,
                    opacity: 0.7,
                  });

                  if (round < totalRounds) {
                    setRound((prevRound) => prevRound + 1);
                    startNewRound();
                  } else {
                    endGame();
                  }
                }, 2000);
              });

              // Hover effects, highlight while hovering if the game is active
              polyline.on('mouseover', function () {
                if (gameActiveRef.current && !gameOverRef.current) {
                  this.setStyle({ weight: 6, opacity: 0.9 });
                }
              });

              polyline.on('mouseout', function () {
                // Always return to blue (no highlighting)
                this.setStyle({
                  color: '#3B82F6',
                  weight: 4,
                  opacity: 0.7,
                });
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
    // Cleanup when streets change or component unmounts
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapInitialized.current = false;
      }
    };
  }, [streets, centerArray]);

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
    setGameOver(true);
    setFinalScore(score);
    setGameActive(false);
  };

  const restartGame = () => {
    setScore(0);
    setRound(1);
    setGameOver(false);
    setFinalScore(0);
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

    startNewRound();
  };

  if (loading) {
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

  if (error) {
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
        >
          <p style={{ color: '#EF4444' }}>Error loading streets: {error}</p>
          <button onClick={loadStreets} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (streets.length === 0 && !loading) {
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
          <p style={{ color: '#6b7280' }}>Try increasing the radius or changing the difficulty</p>
          <button
            onClick={loadStreets}
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
            Retry
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
            Back Of Your Hand - Albuquerque
          </h1>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {difficulty === Difficulty.Tourist && 'Difficulty: Tourist (Major roads)'}
            {difficulty === Difficulty.Resident && 'Difficulty: Resident (+ Tertiary roads)'}
            {difficulty === Difficulty.TaxiDriver && 'Difficulty: Taxi Driver (All roads)'}
            {' • '}
            {Math.round(radius / 1000)}km radius
          </div>

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
        </div>
      </div>

      {!gameOver ? (
        <div className="game-content">
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
      ) : (
        <div className="game-over">
          <div className="game-over-content">
            <Award size={64} className="trophy-icon" />
            <h2>Game Over!</h2>
            <div className="final-score">
              <p>Final Score</p>
              <h1>{finalScore}</h1>
              <p className="score-message">
                {finalScore >= 40
                  ? '🎉 Excellent!'
                  : finalScore >= 25
                    ? '👏 Good job!'
                    : '💪 Keep practicing!'}
              </p>
            </div>
            <button onClick={restartGame} className="btn-restart">
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
