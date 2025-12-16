import { useState, useEffect, useRef } from 'react';
import { Trophy, Target, Star, Award, RefreshCw, User, LogOut } from 'lucide-react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { useGameState } from '../hooks/useGameState';
import { useGameRefs } from '../hooks/useGameRefs';
import { useQuizArea } from '../hooks/useQuizArea';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { usePlayingMap } from '../hooks/usePlayingMap';
import { useStreetPolylines } from '../hooks/useStreetPolylines';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';
import './BackOfYourHand.css';

export default function StreetFinderGame() {
  const [totalRounds] = useState(5);
  const [difficulty] = useState(Difficulty.Tourist);
  const mapRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
    handleQuizThisArea,
    resetQuizArea,
  } = useQuizArea();

  // Load streets from Overpass API - only when quizCenter is set
  const { streets, loading, error, loadStreets } = useOverpassStreets({
    center: quizCenter,
    radius: quizRadius,
    shape: PresetAreaShape.Circle,
    difficulty,
    numberOfQuestions: 75  // Reduced from 50 to stay under localStorage quota
  });

  
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
    streets,
    mapRef,
  });

  // Use the appropriate map instance based on game mode
  const mapInstanceRef = gameMode === 'selecting' ? selectionMapInstanceRef : playingMapInstanceRef;

  // Street polylines management (only for playing mode)
  const {
    resetPolylineColors,
    clearPolylines,
  } = useStreetPolylines({
    streets,
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
    // Only load if we don't have streets for this center yet
    const centerKey = quizCenter ? `${quizCenter.lat},${quizCenter.lng}` : null;
    
    if (quizCenter && gameMode === 'playing' && streetsLoadedForCenter.current !== centerKey) {
      loadStreets();
      streetsLoadedForCenter.current = centerKey;
    }
  }, [quizCenter, gameMode, loadStreets]);

  // Update streets ref when streets change
  useEffect(() => {
    updateStreetsRef(streets); 
  }, [streets, updateStreetsRef]);

  // Handle "Quiz this Area" button click
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
    setGameMode('selecting');
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
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      
      <div className="game-header">
        <div className="game-info">
          <h1 className="game-title">
            <Target size={32} />
            Back Of Your Hand
          </h1>
          {gameMode !== 'selecting' && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {difficulty === Difficulty.Tourist && 'Difficulty: Easy (Major roads)'}
              {difficulty === Difficulty.Resident && 'Difficulty: Medium (+ Tertiary roads)'}
              {difficulty === Difficulty.TaxiDriver && 'Difficulty: Hard (All roads)'}
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

        <div className="auth-buttons">
          {isAuthenticated ? (
            <div className="user-info">
              <span className="username">
                <User size={18} />
                {user?.username}
              </span>
              <button onClick={logout} className="btn-logout">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="btn-login">
              <User size={18} />
              Sign In
            </button>
          )}
        </div>
      </div>

      <div className="game-content">
        {gameMode === 'selecting' && (
          <div className="quiz-button-overlay">
            <button onClick={handleQuizThisAreaClick} className="btn-quiz-area">
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
