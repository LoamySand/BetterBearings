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
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const mapInitialized = useRef(false);
  
  const gameActiveRef = useRef(false);
  const currentStreetRef = useRef(null);
  const gameOverRef = useRef(false);

  // Load streets from API
  const { streets, loading, error, refreshStreets } = useStreets(10);
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
    if (mapInitialized.current || !streetsRef.current.length) return;

    let checkInterval;
    
    const initMap = () => {
      if (!window.L || !mapRef.current) {
        return;
      }

      if (checkInterval) {
        clearInterval(checkInterval);
      }

      console.log('Creating map...');
      
      try {
        const map = window.L.map(mapRef.current, {
          center: center,
          zoom: 12,
          zoomControl: true
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        console.log('Map created, adding streets...');

        // Draw all streets from API
        streetsRef.current.forEach(street => {
          const polyline = window.L.polyline(street.coordinates, {
            color: '#3B82F6',
            weight: 3,
            opacity: 0.7
          }).addTo(map);
          
          polylinesRef.current[street._id || street.id] = polyline;
        });

        console.log('Streets added:', Object.keys(polylinesRef.current).length);

        // Add click handler using refs
        map.on('click', (e) => {
          console.log('=== MAP CLICKED ===');
          console.log('Game active (ref):', gameActiveRef.current);
          console.log('Current street (ref):', currentStreetRef.current?.name);
          console.log('Game over (ref):', gameOverRef.current);
          
          if (gameOverRef.current) {
            console.log('Game is over');
            return;
          }
          
          if (!currentStreetRef.current) {
            console.log('No current street');
            return;
          }
          
          if (!gameActiveRef.current) {
            console.log('Game not active - waiting for next round');
            return;
          }
          
          console.log('Processing click...');
          handleMapClick(e.latlng);
        });

        mapInstanceRef.current = map;
        mapInitialized.current = true;

        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        console.log('Map fully initialized!');
        startNewRound();

      } catch (error) {
        console.error('Error creating map:', error);
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

  // Highlight current street
  useEffect(() => {
    if (!currentStreet) return;

    console.log('Highlighting street:', currentStreet.name);

    streetsRef.current.forEach(street => {
      const polyline = polylinesRef.current[street._id || street.id];
      if (polyline) {
        const streetId = street._id || street.id;
        const currentStreetId = currentStreet._id || currentStreet.id;
        
        if (streetId === currentStreetId) {
          polyline.setStyle({
            color: '#EF4444',
            weight: 5,
            opacity: 0.9
          });
        } else {
          polyline.setStyle({
            color: '#3B82F6',
            weight: 3,
            opacity: 0.7
          });
        }
      }
    });
  }, [currentStreet]);

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

  const handleMapClick = (clickedPoint) => {
    const street = currentStreetRef.current;
    if (!street) return;

    let minDistance = Infinity;

    for (let i = 0; i < street.coordinates.length - 1; i++) {
      const [lat1, lng1] = street.coordinates[i];
      const [lat2, lng2] = street.coordinates[i + 1];
      
      const distance = pointToLineDistance(
        clickedPoint.lat,
        clickedPoint.lng,
        lat1,
        lng1,
        lat2,
        lng2
      );
      
      minDistance = Math.min(minDistance, distance);
    }

    console.log('Distance to street:', minDistance);

    const threshold = 0.01;
    const isCorrect = minDistance < threshold;

    if (isCorrect) {
      const points = 10;
      setScore(prevScore => prevScore + points);
      setFeedback('🎉 Correct! +10 points');
      console.log('✓ CORRECT!');
    } else {
      setFeedback('❌ Not quite! That wasn\'t ' + street.name);
      console.log('✗ INCORRECT');
    }

    setGameActive(false);

    setTimeout(() => {
      if (round < totalRounds) {
        setRound(prevRound => prevRound + 1);
        startNewRound();
      } else {
        endGame();
      }
    }, 2000);
  };

  const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
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
    
    streetsRef.current.forEach(street => {
      const polyline = polylinesRef.current[street._id || street.id];
      if (polyline) {
        polyline.setStyle({
          color: '#3B82F6',
          weight: 3,
          opacity: 0.7
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

  return (
    <div className="game-container">
      <div className="game-header">
        <div className="game-info">
          <h1 className="game-title">
            <Target size={32} />
            Street Finder Game
          </h1>
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
                    ? 'Click on the red highlighted street on the map below' 
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