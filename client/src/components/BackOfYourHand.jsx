import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Trophy, Target, Star, Award, RefreshCw, User, LogOut, Save } from 'lucide-react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { useGameState } from '../hooks/useGameState';
import { useGameRefs } from '../hooks/useGameRefs';
import { useQuizArea } from '../hooks/useQuizArea';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { usePlayingMap } from '../hooks/usePlayingMap';
import { useStreetPolylines } from '../hooks/useStreetPolylines';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from './AppHeader';
import AuthModal from './AuthModal';
import ProfileDropdown from './ProfileDropdown';
import SaveStreetSetModal from './SaveStreetSetModal';
import QuizAreaModule from './QuizAreaModule';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';
import './BackOfYourHand.css';
import { API_URL } from '../config';


export default function StreetFinderGame() {
  const location = useLocation();
  const [totalRounds, setTotalRounds] = useState(5);
  const [difficulty] = useState(Difficulty.Tourist);
  const [streetSets, setStreetSets] = useState([]);
  const mapRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [preloadedStreets, setPreloadedStreets] = useState(null);
  const [streetSetName, setStreetSetName] = useState(null);

  const { user, logout, isAuthenticated } = useAuth();

  // Game state management
  const {
    gameMode,
    score,
    round,
    currentStreet,
    gameActive,
    feedback,
    finalScore,
    setGameMode,
    setScore,
    setRound,
    setGameActive,
    setFeedback,
    startNewRound,
    endGame,
    resetGame,
    updateStreetsRef,
  } = useGameState(totalRounds);

  // Quiz area management
  const {
    quizCenter,
    quizRadius,
    setQuizCenter,
    setQuizRadius,
    handleQuizThisArea,
    resetQuizArea,
  } = useQuizArea();

  // Load streets from Overpass API - only when no preloaded streets
  // For 'creating' mode, fetch more streets (50). For 'playing' mode, use totalRounds.
  const numberOfQuestionsForAPI = gameMode === 'creating' ? 50 : totalRounds;
  
  const { streets, loading, error, loadStreets } = useOverpassStreets({
    center: !preloadedStreets ? quizCenter : null,
    radius: quizRadius,
    shape: PresetAreaShape.Circle,
    difficulty,
    numberOfQuestions: numberOfQuestionsForAPI
  });

  // Use preloaded streets if available, otherwise use fetched streets
  // For 'creating' mode, don't limit. For 'playing' mode, limit to totalRounds.
  const activeStreets = preloadedStreets 
    ? preloadedStreets.slice(0, totalRounds)
    : gameMode === 'creating'
      ? streets
      : streets.slice(0, totalRounds);

  
  // Game refs
  const {
    gameActiveRef,
    currentStreetRef,
    gameOverRef,
    roundRef,
  } = useGameRefs(gameActive, currentStreet, gameMode, round);

  // Selection map (before quiz starts)
  const {
    mapInstanceRef: selectionMapInstanceRef,
  } = useLeafletMap({
    gameMode,
    quizCenter: null,
    mapType: 'selecting',
    mapRef,
  });

  // Playing map (during the game)
  const {
    mapInstanceRef: playingMapInstanceRef,
    mapInitialized: playingMapInitialized,
    isMapReady: playingMapReady,
    cleanupMap: cleanupPlayingMap,
  } = usePlayingMap({
    gameMode,
    quizCenter,
    streets: activeStreets,
    mapRef,
  });

  // Use the appropriate map instance based on game mode
  const mapInstanceRef = gameMode === 'selecting' ? selectionMapInstanceRef : playingMapInstanceRef;

  // Street polylines management (only for playing mode)
  const {
    resetPolylineColors,
    clearPolylines,
  } = useStreetPolylines({
    streets: activeStreets,
    quizCenter,
    mapRef,
    mapInstanceRef: playingMapInstanceRef,
    isMapReady: playingMapReady,
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
  });

  // Load streets when quiz area is selected (only on initial load)
  const streetsLoadedForCenter = useRef(null);
  
  useEffect(() => {
    // Only load if we don't have streets for this center yet and no preloaded streets
    const centerKey = quizCenter ? `${quizCenter.lat},${quizCenter.lng}` : null;
    
    // ONLY load from Overpass if:
    // 1. We have a quiz center
    // 2. We're in playing or creating mode
    // 3. We haven't loaded for this center yet
    // 4. We do NOT have preloaded streets
    if (quizCenter && (gameMode === 'playing' || gameMode === 'creating') && streetsLoadedForCenter.current !== centerKey && !preloadedStreets) {
      console.log('🔄 Calling loadStreets for center:', centerKey);
      loadStreets();
      streetsLoadedForCenter.current = centerKey;
    } else if (preloadedStreets) {
      console.log('✅ Using preloaded streets, skipping Overpass API call');
      streetsLoadedForCenter.current = centerKey;
    }
  }, [quizCenter, gameMode, loadStreets, preloadedStreets]);

  // Update streets ref when streets change
  useEffect(() => {
    updateStreetsRef(activeStreets); 
  }, [activeStreets, updateStreetsRef]);

  // Handle preloaded street set from navigation
  useEffect(() => {
    if (location.state?.streetSet) {
      const { streetSet } = location.state;
      console.log('Loading street set:', streetSet.name);
      console.log('Streets loaded:', streetSet.streets);
      console.log('First street points format:', streetSet.streets[0]?.points);
      setPreloadedStreets(streetSet.streets);
      setStreetSetName(streetSet.name);
      // Set the quiz area to match the street set
      setQuizCenter(streetSet.center);
      setQuizRadius(streetSet.radius);
      // Switch to playing mode
      setGameMode('playing');
      // Clear the navigation state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setQuizCenter, setQuizRadius, setGameMode]);

  // Load user's street sets on mount
  useEffect(() => {
    const fetchStreetSets = async () => {
      if (!isAuthenticated) return;
      
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/street-sets`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setStreetSets(data);
        }
      } catch (err) {
        console.error('Failed to load street sets:', err);
      }
    };

    fetchStreetSets();
  }, [isAuthenticated]);

  // Handle quiz module start
  const handleQuizModuleStart = async (config) => {
    try {
      // Map difficulty string to enum
      const difficultyMap = {
        'easy': Difficulty.Tourist,
        'medium': Difficulty.Resident,
        'hard': Difficulty.TaxiDriver,
      };

      if (config.streetSet === 'current-location') {
        // Get current map bounds
        if (!selectionMapInstanceRef.current) {
          alert('Map not initialized. Please try again.');
          return;
        }

        const map = selectionMapInstanceRef.current;
        const bounds = map.getBounds();
        const center = bounds.getCenter();
        
        // Calculate radius from bounds (max distance from center to corner)
        const maxDist = Math.max(
          map.distance(center, bounds.getNorthWest()),
          map.distance(center, bounds.getNorthEast()),
          map.distance(center, bounds.getSouthWest()),
          map.distance(center, bounds.getSouthEast())
        );

        // Cap radius at 5km for performance
        const radius = Math.min(maxDist, 5000);

        if (radius < 500) {
          alert('Area too small. Please zoom out more.');
          return;
        }

        // Set center as object {lat, lng}, not array
        setQuizCenter({ lat: center.lat, lng: center.lng });
        setQuizRadius(radius);
        setStreetSetName(`${Math.round(radius / 1000)}km area`);
        setPreloadedStreets(null); // No preloaded streets for current location
      } else {
        // Load streets from selected street set
        const selectedSet = streetSets.find(s => s._id === config.streetSet);
        if (selectedSet) {
          try {
            // Fetch the full street set with streets data
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/street-sets/${config.streetSet}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (!response.ok) throw new Error('Failed to fetch full street set');
            
            const fullStreetSet = await response.json();
            setQuizCenter(fullStreetSet.center);
            setQuizRadius(fullStreetSet.radius);
            setStreetSetName(fullStreetSet.name);

            // Filter to only included streets and convert format
            const includedStreets = fullStreetSet.streets?.filter(s => s.included !== false) || [];
            
            if (includedStreets.length > 0) {
              // Convert database format to game format
              const convertedStreets = includedStreets.map(street => ({
                ...street,
                // Convert coordinates [[lat, lng], ...] to points [{lat, lng}, ...]
                points: street.coordinates?.map(coordArray => 
                  Array.isArray(coordArray) && coordArray.length >= 2
                    ? coordArray.map(point => 
                        Array.isArray(point) 
                          ? { lat: point[0], lng: point[1] }
                          : point
                      )
                    : []
                ) || [],
              }));
              
              // Randomly select streets based on numQuestions
              const shuffled = convertedStreets.sort(() => Math.random() - 0.5);
              const selectedStreets = shuffled.slice(0, config.numQuestions);
              setPreloadedStreets(selectedStreets);
              console.log('✅ Converted and selected streets:', selectedStreets.length);
            }
          } catch (err) {
            console.error('Error loading street set:', err);
            alert('Error loading street set. Please try again.');
            return;
          }
        }
      }

      // Set total rounds from selected number of questions
      setTotalRounds(config.numQuestions);

      // Remove selection map and transition to playing mode
      if (selectionMapInstanceRef.current) {
        selectionMapInstanceRef.current.remove();
        selectionMapInstanceRef.current = null;
      }
      setGameMode('playing');
    } catch (err) {
      console.error('Error starting quiz:', err);
      alert('Error starting quiz. Please try again.');
    }
  };

  // Handle creating a new street set from selected area
  const handleCreateStreetSet = (config) => {
    console.log('handleCreateStreetSet called with config:', config);
    console.log('selectionMapInstanceRef.current:', selectionMapInstanceRef.current);
    console.log('quizCenter:', quizCenter, 'quizRadius:', quizRadius);

    let center = config.center || quizCenter;
    let radius = config.radius || quizRadius;

    // If user hasn't explicitly selected an area, get current map bounds
    if (!center || !radius) {
      if (!selectionMapInstanceRef.current) {
        alert('Map not initialized. Please try again.');
        return;
      }

      try {
        const map = selectionMapInstanceRef.current;
        const bounds = map.getBounds();
        const mapCenter = bounds.getCenter();
        
        console.log('Got map bounds, center:', mapCenter);

        // Calculate radius from bounds
        const maxDist = Math.max(
          map.distance(mapCenter, bounds.getNorthWest()),
          map.distance(mapCenter, bounds.getNorthEast()),
          map.distance(mapCenter, bounds.getSouthWest()),
          map.distance(mapCenter, bounds.getSouthEast())
        );

        // Cap radius at 5km
        radius = Math.min(maxDist, 5000);

        if (radius < 500) {
          alert('Area too small. Please zoom out more.');
          return;
        }

        center = { lat: mapCenter.lat, lng: mapCenter.lng };
        console.log('Calculated center and radius:', center, radius);
      } catch (err) {
        console.error('Error getting map bounds:', err);
        alert('Could not get map bounds. Please try again.');
        return;
      }
    }

    console.log('Creating street set with center:', center, 'radius:', radius);
    setQuizCenter(center);
    setQuizRadius(radius);
    
    // Trigger the Overpass API call by removing preloaded streets
    setPreloadedStreets(null);
    
    // Set a flag so we know to open save modal after streets load
    setStreetSetName(null);
    
    // Start loading the streets - this will trigger the useEffect to call loadStreets
    // Once streets are loaded, we'll open the save modal
    setGameMode('creating');
  };

  // Handle "Quiz this Area" button click (legacy)
  const handleQuizThisAreaClick = () => {
    handleQuizThisArea(mapInstanceRef.current, () => {
      // Remove selection map and transition to playing mode
      if (selectionMapInstanceRef.current) {
        selectionMapInstanceRef.current.remove();
        selectionMapInstanceRef.current.current = null;
      }
      setGameMode('playing');
    });
  };

  // Play same area again
  const playSameArea = () => {
    resetGame();
    resetPolylineColors();
    setGameMode('playing');
    // Start new round after a short delay to ensure state is updated
    setTimeout(() => {
      startNewRound();
    }, 100);
  };

  // Choose new area
  const chooseNewArea = () => {
    cleanupPlayingMap();
    clearPolylines();
    resetGame();
    resetQuizArea();
    
    streetsLoadedForCenter.current = null;
    setPreloadedStreets(null);
    setStreetSetName(null);
    setGameMode('selecting');
  };

  // Save current street set
  const handleSaveStreetSet = async ({ name, description }) => {
    if (!isAuthenticated) {
      alert('Please sign in to save street sets');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        alert('No authentication token found. Please log in again.');
        return;
      }

      console.log('=== SAVING STREET SET ===');
      console.log('Active streets count:', activeStreets.length);
      console.log('First street sample:', activeStreets[0]);
      console.log('First street points:', activeStreets[0]?.points);
      console.log('Points type:', typeof activeStreets[0]?.points);
      console.log('Points is array:', Array.isArray(activeStreets[0]?.points));

      // Function to calculate difficulty based on street type
      const calculateDifficulty = (street) => {
        const type = street.type?.toLowerCase() || '';
        const length = street.length || 0;

        console.log(`Calculating difficulty for "${street.name}":`, {
          type: street.type,
          typeLower: type,
          length: length,
          rawStreet: street
        });

        let difficulty = 2; // Default to medium

        // Easy = Primary roads (motorway, trunk, primary)
        if (type.includes('primary') || type.includes('motorway') || type.includes('trunk')) {
          difficulty = 1;
          console.log(`  -> Easy (primary road)`);
        }
        // Medium = Secondary roads
        else if (type.includes('secondary')) {
          difficulty = 2;
          console.log(`  -> Medium (secondary road)`);
        }
        // Hard = Tertiary and smaller roads
        else if (type.includes('tertiary') || type.includes('residential') || 
            type.includes('living_street') || type.includes('service') || 
            type.includes('unclassified')) {
          difficulty = 3;
          console.log(`  -> Hard (tertiary/small road)`);
        } else {
          console.log(`  -> Default Medium (no match)`);
        }

        // Very short streets are harder (bump up difficulty)
        if (length > 0 && length < 1500 && difficulty < 3) {
          const oldDiff = difficulty;
          difficulty = Math.min(difficulty + 1, 3);
          console.log(`  -> Bumped from ${oldDiff} to ${difficulty} (short street: ${length}m)`);
        }

        console.log(`  -> Final difficulty: ${difficulty}`);
        return difficulty;
      };

      const streetsToSave = activeStreets.map(street => {
        if (!street.points || !Array.isArray(street.points)) {
          console.warn('Street missing points:', street.name);
          return null;
        }
        
        return {
          osmId: street.osmId,
          name: street.name,
          // Convert from [{lat, lng}, ...] to [[lat, lng], ...]
          coordinates: street.points.map(polyline => 
            Array.isArray(polyline) ? polyline.map(point => [point.lat, point.lng]) : []
          ),
          type: street.type,
          length: street.length,
          width: street.width,
          alternativeName: street.alternativeName,
          isEnclosedArea: street.isEnclosedArea,
          included: true,
          difficulty: calculateDifficulty(street),
        };
      }).filter(s => s !== null);

      console.log('Streets to save count:', streetsToSave.length);
      console.log('First saved street sample:', streetsToSave[0]);
      console.log('First saved street coordinates:', streetsToSave[0]?.coordinates);
      console.log('First coordinate sample:', streetsToSave[0]?.coordinates[0]);

      const response = await fetch(`${API_URL}/street-sets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          center: quizCenter,
          radius: quizRadius,
          streets: streetsToSave,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save street set');
      }

      alert('Street set saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      throw new Error(err.message || 'Failed to save street set');
    }
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
  if (gameMode === 'playing' && activeStreets.length === 0 && !loading && !preloadedStreets) {
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
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      
      {gameMode !== 'selecting' && (
        <div className="game-info-bar">
          {streetSetName && (
            <span className="street-set-badge">
              📚 {streetSetName}
            </span>
          )}
          <span className="game-meta">
            {difficulty === Difficulty.Tourist && 'Difficulty: Easy (Major roads)'}
            {difficulty === Difficulty.Resident && 'Difficulty: Medium (+ Tertiary roads)'}
            {difficulty === Difficulty.TaxiDriver && 'Difficulty: Hard (All roads)'}
            {quizRadius && ` • ${Math.round(quizRadius / 1000)}km radius`}
          </span>
          
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
      )}

      <div className="game-content">
        {gameMode === 'selecting' && (
          <div className="quiz-button-overlay">
            <QuizAreaModule 
              streetSets={streetSets}
              onQuizStart={handleQuizModuleStart}
              mapCenter={quizCenter}
              mapRadius={quizRadius}
            />
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
                {isAuthenticated && !streetSetName && (
                  <button 
                    onClick={() => setShowSaveModal(true)} 
                    className="btn-save-set"
                    title="Save as Street Set"
                  >
                    <Save size={16} />
                    Save Set
                  </button>
                )}
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

      {showSaveModal && (
        <SaveStreetSetModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveStreetSet}
          streets={streets}
          center={quizCenter}
          radius={quizRadius}
        />
      )}

      {gameMode === 'creating' && streets && streets.length > 0 && (
        <SaveStreetSetModal
          onClose={() => {
            setGameMode('selecting');
            setQuizCenter(null);
            setQuizRadius(null);
          }}
          onSave={handleSaveStreetSet}
          streets={streets}
          center={quizCenter}
          radius={quizRadius}
        />
      )}
    </div>
  );
}
