import { useState, useEffect, useRef } from 'react';
import { Trophy, Target, Star, Award } from 'lucide-react';
import { streets, getRandomStreet } from '../data/streets';
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

  const center = [35.0844, -106.6504];

  // Initialize map once
  useEffect(() => {
    if (mapInitialized.current) return;

    let checkInterval;
    
    const initMap = () => {
      // Check if Leaflet is loaded and map container exists
      if (!window.L) {
        console.log('Leaflet not loaded yet...');
        return;
      }

      if (!mapRef.current) {
        console.log('Map container not ready...');
        return;
      }

      // Clear the check interval
      if (checkInterval) {
        clearInterval(checkInterval);
      }

      console.log('Creating map...');
      
      try {
        // Create the map
        const map = window.L.map(mapRef.current, {
          center: center,
          zoom: 12,
          zoomControl: true
        });

        // Add tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        console.log('Map created, adding streets...');

        // Draw all streets
        streets.forEach(street => {
          const polyline = window.L.polyline(street.coordinates, {
            color: '#3B82F6',
            weight: 3,
            opacity: 0.7
          }).addTo(map);
          
          polylinesRef.current[street.id] = polyline;
        });

        console.log('Streets added:', Object.keys(polylinesRef.current).length);

        // Add click handler
        map.on('click', (e) => {
          handleMapClick(e.latlng);
        });

        mapInstanceRef.current = map;
        mapInitialized.current = true;

        // Force map to update its size
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

        console.log('Map fully initialized!');

        // Start the first round
        startNewRound();

      } catch (error) {
        console.error('Error creating map:', error);
      }
    };

    // Try to initialize immediately
    initMap();

    // If not ready, keep checking
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
  }, []);

  // Highlight current street
  useEffect(() => {
    if (!currentStreet) return;

    console.log('Highlighting street:', currentStreet.name);

    streets.forEach(street => {
      const polyline = polylinesRef.current[street.id];
      if (polyline) {
        if (street.id === currentStreet.id) {
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

  const startNewRound = () => {
    const newStreet = getRandomStreet();
    console.log('New street:', newStreet.name);
    setCurrentStreet(newStreet);
    setGameActive(true);
    setFeedback('');
  };

  const handleMapClick = (clickedPoint) => {
    if (!gameActive) {
      console.log('Game not active');
      return;
    }
    
    console.log('Clicked at:', clickedPoint);
    checkStreetClick(clickedPoint);
  };

  const checkStreetClick = (clickedPoint) => {
    if (!currentStreet || !gameActive) return;

    const street = currentStreet;
    let minDistance = Infinity;

    // Check distance to street line
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

    console.log('Distance:', minDistance);

    const threshold = 0.01;
    const isCorrect = minDistance < threshold;

    if (isCorrect) {
      const points = 10;
      setScore(score + points);
      setFeedback('🎉 Correct! +10 points');
    } else {
      setFeedback('❌ Not quite! That wasn\'t ' + currentStreet.name);
    }

    setGameActive(false);

    setTimeout(() => {
      if (round < totalRounds) {
        setRound(round + 1);
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
    
    streets.forEach(street => {
      const polyline = polylinesRef.current[street.id];
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
                <p className="instruction">Click on the red highlighted street on the map below</p>
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