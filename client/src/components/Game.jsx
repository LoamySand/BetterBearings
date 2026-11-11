import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Trophy,
  Star,
  Award,
  RefreshCw,
  Save,
  MapPin,
  WifiOff,
  TriangleAlert,
  MapPinOff,
  SearchX,
} from 'lucide-react';
import StatusPanel from './StatusPanel';
import { describeStreetError } from '../utils/streetErrors';
import { useStreets } from '../hooks/useStreets';
import { useGameState } from '../hooks/useGameState';
import { useGameRefs } from '../hooks/useGameRefs';
import { useQuizArea } from '../hooks/useQuizArea';
import { useLeafletMap } from '../hooks/useLeafletMap';
import { usePlayingMap } from '../hooks/usePlayingMap';
import { useStreetPolylines } from '../hooks/useStreetPolylines';
import { useQuizCircle } from '../hooks/useQuizCircle';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from './AppHeader';
import AuthModal from './AuthModal';
import SaveStreetSetModal from './SaveStreetSetModal';
import QuizAreaModule from './QuizAreaModule';
import { Difficulty } from '../utils/areaTypes';
import { planGame, filterByLevel } from '../utils/gamePlan';
import { quizAreaFor, formatRadius } from '../utils/quizArea';
import './Game.css';
import { API_URL } from '../config';
import useDialog from '../hooks/useDialog';

// Current Location asks /api/streets for its maximum; every street returned is an option (KAN-70)
const CURRENT_LOCATION_POOL = 200;

const LEVEL_LABELS = {
  [Difficulty.Tourist]: 'Easy (Major roads)',
  [Difficulty.Resident]: 'Medium (+ Tertiary roads)',
  [Difficulty.TaxiDriver]: 'Hard (All roads)',
};

// Matches the CSS breakpoint where the quiz panel becomes a bottom sheet
const PHONE_QUERY = '(max-width: 767px)';

export default function StreetFinderGame() {
  const location = useLocation();
  const [totalRounds, setTotalRounds] = useState(5);
  const [difficulty, setDifficulty] = useState(Difficulty.Tourist);
  const [streetSets, setStreetSets] = useState([]);
  const mapRef = useRef(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // "Play This Set" on StreetSets or StreetSetDetail navigates to / with the set's id in navigation
  // state. The quiz panel opens with that set selected so the player picks the question count.
  const [initialSetId] = useState(() => location.state?.streetSetId ?? null);
  const [preloadedStreets, setPreloadedStreets] = useState(null);
  const [streetSetName, setStreetSetName] = useState(null);
  // Play Same Area bumps this to draw new questions from the same pool
  const [planSeed, setPlanSeed] = useState(0);
  // Phones show the quiz panel as a bottom sheet behind a button so the map comes first.
  // Play This Set opens it, since the player came here to pick a question count.
  // Ignored at 768 px and up, where the panel is always shown top right.
  const [quizPanelOpen, setQuizPanelOpen] = useState(() => Boolean(initialSetId));
  const quizToggleRef = useRef(null);
  const quizPanelRef = useRef(null);
  const quizPanelId = useId();
  // The circle is the Current Location area; a saved set has its own center and radius.
  // QuizAreaModule starts on the Play This Set set, else on Current Location.
  const [quizCurrentLocation, setQuizCurrentLocation] = useState(() => !initialSetId);

  const { isAuthenticated } = useAuth();

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
  } = useGameState(totalRounds, 'selecting');

  // Quiz area management
  const { quizCenter, quizRadius, setQuizCenter, setQuizRadius, resetQuizArea } = useQuizArea({
    initialCenter: null,
    initialRadius: 5000,
  });

  // Load streets from /api/streets - only when no preloaded streets
  // For 'creating' mode, fetch 50. For 'playing' mode, fetch the whole pool; the plan picks questions.
  const numberOfQuestionsForAPI = gameMode === 'creating' ? 50 : CURRENT_LOCATION_POOL;

  const { streets, loading, error, errorKind, loadStreets } = useStreets({
    center: !preloadedStreets ? quizCenter : null,
    radius: quizRadius,
    difficulty,
    numberOfQuestions: numberOfQuestionsForAPI,
  });

  // Plan the game once per pool and question count (utils/gamePlan.js). Planning on every render
  // would reshuffle mid-game and redraw the map. planSeed is a dependency on purpose: Play Same
  // Area changes it to draw new questions from the same pool.
  const pool = preloadedStreets ?? streets;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => planGame(pool, totalRounds), [pool, totalRounds, planSeed]);
  const roundsInGame = plan.count;

  // Every street in the pool is drawn as an option. 'creating' mode shows what will be saved.
  const activeStreets = gameMode === 'creating' ? streets : plan.options;

  // Game refs
  const { gameActiveRef, currentStreetRef, gameOverRef, roundRef } = useGameRefs(
    gameActive,
    currentStreet,
    gameMode,
    round
  );

  // Selection map (before quiz starts)
  const {
    mapInstanceRef: selectionMapInstanceRef,
    selectionMap,
    removeSelectionMap,
  } = useLeafletMap({
    gameMode,
    quizCenter: null,
    mapType: 'selecting',
    mapRef,
  });

  // The Current Location area, drawn on the selection map (KAN-76)
  useQuizCircle({ map: selectionMap, active: gameMode === 'selecting' && quizCurrentLocation });

  // Playing map (during the game)
  const {
    mapInstanceRef: playingMapInstanceRef,
    isMapReady: playingMapReady,
    cleanupMap: cleanupPlayingMap,
  } = usePlayingMap({
    gameMode,
    quizCenter,
    streets: activeStreets,
    mapRef,
  });

  // Street polylines management (only for playing mode)
  const { resetPolylineColors, clearPolylines } = useStreetPolylines({
    streets: activeStreets,
    quizCenter,
    mapRef,
    mapInstanceRef: playingMapInstanceRef,
    isMapReady: playingMapReady,
    gameActiveRef,
    currentStreetRef,
    gameOverRef,
    roundRef,
    totalRounds: roundsInGame,
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
    // Only load if we don't have streets for this center and difficulty yet, and no preloaded
    // streets. Difficulty is in the key so a new selector choice on the same area refetches.
    const centerKey = quizCenter ? `${quizCenter.lat},${quizCenter.lng},${difficulty}` : null;

    // ONLY call /api/streets if:
    // 1. We have a quiz center
    // 2. We're in playing or creating mode
    // 3. We haven't loaded for this center yet
    // 4. We do NOT have preloaded streets
    if (
      quizCenter &&
      (gameMode === 'playing' || gameMode === 'creating') &&
      streetsLoadedForCenter.current !== centerKey &&
      !preloadedStreets
    ) {
      loadStreets();
      streetsLoadedForCenter.current = centerKey;
    } else if (preloadedStreets) {
      streetsLoadedForCenter.current = centerKey;
    }
  }, [quizCenter, difficulty, gameMode, loadStreets, preloadedStreets]);

  // Hand the planned questions to the round logic
  useEffect(() => {
    updateStreetsRef(plan.questions);
  }, [plan, updateStreetsRef]);

  // Clear the navigation state so a refresh doesn't replay the set
  useEffect(() => {
    if (initialSetId) window.history.replaceState({}, document.title);
  }, [initialSetId]);

  const openQuizPanel = () => {
    setQuizPanelOpen(true);
    // Move focus into the sheet once it's rendered
    requestAnimationFrame(() => quizPanelRef.current?.querySelector('select')?.focus());
  };

  const closeQuizPanel = () => {
    setQuizPanelOpen(false);
    if (window.matchMedia(PHONE_QUERY).matches) {
      requestAnimationFrame(() => quizToggleRef.current?.focus());
    }
  };

  // Load user's street sets on mount
  useEffect(() => {
    const fetchStreetSets = async () => {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/street-sets`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStreetSets(data);
        }
      } catch (err) {
        // The panel still works with Current Location; log so a failing list isn't silent
        // eslint-disable-next-line no-console
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
        easy: Difficulty.Tourist,
        medium: Difficulty.Resident,
        hard: Difficulty.TaxiDriver,
      };

      // Current Location: which road classes to fetch. Saved set: shown in the info bar.
      setDifficulty(difficultyMap[config.difficulty] ?? Difficulty.Tourist);

      if (config.streetSet === 'current-location') {
        // Get current map bounds
        if (!selectionMapInstanceRef.current) {
          alert('Map not initialized. Please try again.');
          return;
        }

        // Same area as the circle on the map (utils/quizArea.js)
        const { center, radius, tooSmall } = quizAreaFor(selectionMapInstanceRef.current);

        if (tooSmall) {
          alert('Area too small. Please zoom out more.');
          return;
        }

        // The Quiz This Area selector picks which road classes /api/streets may return
        // Set center as object {lat, lng}, not array
        setQuizCenter(center);
        setQuizRadius(radius);
        setStreetSetName(`${formatRadius(radius)} area`);
        setPreloadedStreets(null); // No preloaded streets for current location
      } else {
        // Load streets from selected street set
        const selectedSet = streetSets.find((s) => s.id === config.streetSet);
        if (selectedSet) {
          try {
            // Fetch the full street set with streets data
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${API_URL}/street-sets/${config.streetSet}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) throw new Error('Failed to fetch full street set');

            const fullStreetSet = await response.json();
            setQuizCenter(fullStreetSet.center);
            setQuizRadius(fullStreetSet.radius);
            setStreetSetName(fullStreetSet.name);

            // Included streets at or below the chosen level (KAN-73), converted for the game
            const includedStreets = filterByLevel(
              fullStreetSet.streets?.filter((s) => s.included !== false),
              config.difficulty
            );

            if (includedStreets.length > 0) {
              // Convert database format to game format
              const convertedStreets = includedStreets.map((street) => ({
                ...street,
                // Convert coordinates [[lat, lng], ...] to points [{lat, lng}, ...]
                points:
                  street.coordinates?.map((coordArray) =>
                    Array.isArray(coordArray) && coordArray.length >= 2
                      ? coordArray.map((point) =>
                          Array.isArray(point) ? { lat: point[0], lng: point[1] } : point
                        )
                      : []
                  ) || [],
              }));

              // The whole set is the pool; planGame picks the questions
              setPreloadedStreets(convertedStreets);
            } else {
              setPreloadedStreets([]);
            }
          } catch {
            alert('Error loading street set. Please try again.');
            return;
          }
        }
      }

      // Set total rounds from selected number of questions
      setTotalRounds(config.numQuestions);

      // Remove the selection map through the hook, which also clears its selectionMap state.
      // Removing it here directly left the circle holding a dead map on the way back to
      // the map screen, and Leaflet threw (KAN-76).
      removeSelectionMap();
      setGameMode('playing');
    } catch {
      alert('Error starting quiz. Please try again.');
    }
  };

  // Play same area again
  const playSameArea = () => {
    resetGame();
    setPlanSeed((seed) => seed + 1);
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
    // The quiz panel remounts on its starting selection
    setQuizCurrentLocation(!initialSetId);
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

      const streetsToSave = activeStreets
        .map((street) => {
          if (!street.points || !Array.isArray(street.points)) return null;

          return {
            osmId: street.osmId,
            name: street.name,
            // Convert from [{lat, lng}, ...] to [[lat, lng], ...]
            coordinates: street.points.map((polyline) =>
              Array.isArray(polyline) ? polyline.map((point) => [point.lat, point.lng]) : []
            ),
            type: street.type,
            length: street.length,
            width: street.width,
            alternativeName: street.alternativeName,
            isEnclosedArea: street.isEnclosedArea,
            included: true,
          };
        })
        .filter((s) => s !== null);

      const response = await fetch(`${API_URL}/street-sets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          center: quizCenter,
          radius: quizRadius,
          // The server labels each street from its road type (KAN-73)
          streets: streetsToSave,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save street set');
      }

      alert('Street set saved successfully!');
    } catch (err) {
      throw new Error(err.message || 'Failed to save street set');
    }
  };

  // Loading, error and empty states keep the header and put one card where the map goes (KAN-63)
  const statusScreen = (panel) => (
    <div className="game-container">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      <main className="status-page">{panel}</main>
    </div>
  );

  const newAreaButton = (
    <button type="button" className="status-panel-action" onClick={chooseNewArea}>
      <MapPin size={20} aria-hidden="true" />
      Choose another area
    </button>
  );

  if (gameMode === 'playing' && loading) {
    return statusScreen(<StatusPanel variant="loading" title="Loading streets..." />);
  }

  if (gameMode === 'playing' && error) {
    const problem = describeStreetError({ kind: errorKind, message: error });
    const icon =
      { offline: WifiOff, outside: MapPinOff, empty: SearchX }[problem.kind] ?? TriangleAlert;
    return statusScreen(
      <StatusPanel
        variant={problem.action === 'retry' ? 'error' : 'info'}
        icon={icon}
        title={problem.title}
        actions={
          problem.action === 'retry' ? (
            <>
              <button type="button" className="status-panel-action" onClick={loadStreets}>
                <RefreshCw size={20} aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                className="status-panel-action status-panel-action--secondary"
                onClick={chooseNewArea}
              >
                Choose another area
              </button>
            </>
          ) : (
            newAreaButton
          )
        }
      >
        <p>{problem.message}</p>
      </StatusPanel>
    );
  }

  // Streets came back, but fewer than the 2 a game needs
  if (gameMode === 'playing' && plan.count === 0 && !loading) {
    return statusScreen(
      <StatusPanel
        variant="info"
        icon={SearchX}
        title={
          plan.options.length === 1 ? 'Only one street here' : 'No streets for this level here'
        }
        actions={newAreaButton}
      >
        <p>A game needs at least 2. Try a harder level, or zoom out to make the circle bigger.</p>
      </StatusPanel>
    );
  }

  return (
    <div className="game-container">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      <AppHeader onSignIn={() => setShowAuthModal(true)} />

      {gameMode !== 'selecting' && (
        <div className="game-info-bar">
          {streetSetName && <span className="street-set-badge">📚 {streetSetName}</span>}
          <span className="game-meta">
            Difficulty: {LEVEL_LABELS[difficulty]}
            {quizRadius && ` • ${formatRadius(quizRadius)} radius`}
          </span>
          {plan.capped && plan.count > 0 && (
            <span className="game-meta game-capped" role="status">
              {plan.options.length} streets here, so this game has {plan.count} questions
            </span>
          )}

          {gameMode === 'playing' && (
            <div className="game-stats">
              <div className="game-stat">
                <Star size={20} />
                <span>Score: {score}</span>
              </div>
              <div className="game-stat">
                <Trophy size={20} />
                <span>
                  Round: {round}/{roundsInGame}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <main className="game-content">
        {gameMode === 'selecting' && (
          <>
            <button
              ref={quizToggleRef}
              type="button"
              className="quiz-toggle"
              aria-expanded={quizPanelOpen}
              aria-controls={quizPanelId}
              onClick={openQuizPanel}
            >
              <MapPin size={20} aria-hidden="true" />
              Quiz this area
            </button>
            <div
              ref={quizPanelRef}
              id={quizPanelId}
              className={`quiz-button-overlay${quizPanelOpen ? ' is-open' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && quizPanelOpen) closeQuizPanel();
              }}
            >
              <QuizAreaModule
                streetSets={streetSets}
                initialStreetSetId={initialSetId}
                onQuizStart={handleQuizModuleStart}
                onSelectionChange={setQuizCurrentLocation}
                onClose={closeQuizPanel}
                mapCenter={quizCenter}
                mapRadius={quizRadius}
              />
            </div>
          </>
        )}

        {gameMode === 'playing' && (
          <div className="question-panel">
            {currentStreet ? (
              <>
                {/* Phones hide the info bar, so round and score live here (CSS shows this under 768 px) */}
                <div className="question-stats">
                  <span>
                    Round {round}/{roundsInGame}
                  </span>
                  <span>Score {score}</span>
                </div>
                {plan.capped && (
                  <p className="question-capped">
                    {plan.options.length} streets here, so {plan.count} questions
                  </p>
                )}
                <h2 className="question">Find this street:</h2>
                <h3 className="game-street-name">{currentStreet.name}</h3>
                {feedback && (
                  <div
                    className={`feedback ${feedback.includes('Correct') ? 'correct' : 'incorrect'}`}
                  >
                    {feedback}
                  </div>
                )}
                <p className="instruction">
                  {gameActive ? 'Click or tap it on the map' : 'Wait for next round...'}
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
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </main>

      {gameMode === 'gameOver' && (
        <GameOverDialog
          finalScore={finalScore}
          onPlaySameArea={playSameArea}
          onChooseNewArea={chooseNewArea}
        />
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

// Not closable with Escape: there's nothing to go back to, so the player picks one of the two buttons.
function GameOverDialog({ finalScore, onPlaySameArea, onChooseNewArea }) {
  const { titleId, dialogProps } = useDialog(null, { closeOnEscape: false });

  return (
    <div
      className="game-over"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }}
    >
      <div className="game-over-content" {...dialogProps}>
        <Award size={64} className="trophy-icon" aria-hidden="true" />
        <h2 id={titleId}>Game Over!</h2>
        <div className="final-score">
          <p>Final Score</p>
          <p className="final-score-value">{finalScore}</p>
          <p className="score-message">
            {finalScore >= 40
              ? 'Impressive!'
              : finalScore >= 25
                ? 'Good Try!!'
                : 'Keep practicing!'}
          </p>
        </div>
        <div className="game-over-buttons">
          <button onClick={onPlaySameArea} className="btn-restart">
            🔄 Play Same Area
          </button>
          <button onClick={onChooseNewArea} className="btn-restart btn-secondary">
            🗺️ Choose New Area
          </button>
        </div>
      </div>
    </div>
  );
}
