import { useState, useEffect, useRef } from 'react';
import { Trophy, Target, Star, Award, RefreshCw } from 'lucide-react';
import { useStreets } from '../hooks/useStreets';
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
  const [selectedCity, setSelectedCity] = useState('Albuquerque');
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const mapInitialized = useRef(false);
  
  const gameActiveRef = useRef(false);
  const currentStreetRef = useRef(null);
  const gameOverRef = useRef(false);

  // Load streets from API
  const { streets, loading, error, refreshStreets } = useStreets(10, selectedCity);
  const streetsRef = useRef([]);
  const usedStreetIndices = useRef(new Set());

  const center = [35.0844, -106.6504];

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
        streetsCount: streetsRef.current.length
      });
      return;
    }

    let checkInterval;
    
    const initMap = () => {
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
      center: center,
      zoom: 11.5,
      zoomControl: true
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    console.log('Map created, adding streets...');

    let totalPolylinesDrawn = 0;

    // Draw all streets
    streetsRef.current.forEach((street, streetIndex) => {
      console.log(`\nStreet ${streetIndex + 1}: ${street.name}`);
      console.log(`  Segments: ${street.segments?.length || 0}`);
      
      // Each street can have multiple segments
      if (street.segments && street.segments.length > 0) {
        street.segments.forEach((segment, segmentIndex) => {
          console.log(`  Drawing segment ${segmentIndex + 1}/${street.segments.length} with ${segment.coordinates.length} points`);
          
          const polyline = window.L.polyline(segment.coordinates, {
            color: '#3B82F6',
            weight: 4,
            opacity: 0.7,
            className: 'clickable-street'
          }).addTo(map);
          
          polyline.streetId = street.id;
          polyline.streetName = street.name;
          
          // Click handler
          polyline.on('click', (e) => {
            window.L.DomEvent.stopPropagation(e);
            
            console.log('=== STREET CLICKED ===');
            console.log('Clicked:', street.name);
            console.log('Target:', currentStreetRef.current?.name);
            
            if (gameOverRef.current || !currentStreetRef.current || !gameActiveRef.current) {
              return;
            }
            
            const clickedId = String(street.id);
            const currentId = String(currentStreetRef.current.id);
            const isCorrect = clickedId === currentId;
            
            // Visual feedback - flash the clicked street
            polyline.setStyle({
              color: isCorrect ? '#10B981' : '#EF4444',
              weight: 6,
              opacity: 1
            });
            
            if (isCorrect) {
              setScore(prevScore => prevScore + 10);
              setFeedback('🎉 Correct! +10 points');
              console.log('✓ CORRECT!');
            } else {
              setFeedback(`❌ Wrong! That was ${street.name}, not ${currentStreetRef.current.name}`);
              console.log('✗ INCORRECT');
            }
            
            setGameActive(false);
            
            setTimeout(() => {
              // Reset color back to blue
              polyline.setStyle({
                color: '#3B82F6',
                weight: 4,
                opacity: 0.7
              });
              
              if (round < totalRounds) {
                setRound(prevRound => prevRound + 1);
                startNewRound();
              } else {
                endGame();
              }
            }, 2000);
          });
          
          // Hover effects
          polyline.on('mouseover', function() {
            if (gameActiveRef.current && !gameOverRef.current) {
              this.setStyle({ weight: 6, opacity: 0.9 });
            }
          });
          
          polyline.on('mouseout', function() {
            // Always return to blue (no highlighting)
            this.setStyle({ 
              color: '#3B82F6', 
              weight: 4, 
              opacity: 0.7 
            });
          });
          
          // Store reference
          if (!polylinesRef.current[street.id]) {
            polylinesRef.current[street.id] = [];
          }
          polylinesRef.current[street.id].push(polyline);
          
          totalPolylinesDrawn++;
        });
      }
    });

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

    initMap();

    checkInterval = setInterval(() => {
      if (!mapInitialized.current) {
        initMap();
      } else {
        clearInterval(checkInterval);
      }
    }, 100);

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
  }, [streets]);

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
    Object.values(polylinesRef.current).forEach(polylineArray => {
      if (Array.isArray(polylineArray)) {
        polylineArray.forEach(polyline => {
          if (polyline && polyline.setStyle) {
            polyline.setStyle({
              color: '#3B82F6',
              weight: 4,
              opacity: 0.7
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
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <RefreshCw size={48} className="animate-spin" />
          <p>Loading streets from database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="game-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem',
          padding: '2rem'
        }}>
          <p style={{ color: '#EF4444' }}>Error loading streets: {error}</p>
          <button onClick={refreshStreets} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (streets.length === 0) {
    return (
      <div className="game-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            No streets found for {selectedCity}
          </p>
          <p style={{ color: '#6b7280' }}>
            Please upload street data using the Admin Panel
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '1rem 2rem',
              background: '#4F46E5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Reload Page
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
          <select 
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setGameOver(false);
              setScore(0);
              setRound(1);
              mapInitialized.current = false;
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              borderRadius: '8px',
              border: '2px solid #4F46E5',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="Albuquerque">Albuquerque, NM</option>
            <option value="Santa Fe">Santa Fe, NM</option>
            <option value="Phoenix">Phoenix, AZ</option>
            <option value="Denver">Denver, CO</option>
          </select>
          
          <div className="game-stats">
            <div className="stat">
              <Star size={20} />
              <span>Score: {score}</span>
            </div>
            <div className="stat">
              <Trophy size={20} />
              <span>Round: {round}/{totalRounds}</span>
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
                  <div className={`feedback ${feedback.includes('Correct') ? 'correct' : 'incorrect'}`}>
                    {feedback}
                  </div>
                )}
                <p className="instruction">
                  {gameActive 
                    ? 'Click on the street on the map below' 
                    : 'Wait for next round...'}
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
                minHeight: '500px'
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
                {finalScore >= 40 ? '🎉 Excellent!' : finalScore >= 25 ? '👏 Good job!' : '💪 Keep practicing!'}
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