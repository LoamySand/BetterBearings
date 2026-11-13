import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook to manage game state and logic
 */
export function useGameState(totalRounds = 5, initialMode = 'selecting') {
  const [gameMode, setGameMode] = useState(initialMode);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStreet, setCurrentStreet] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  // endGame reads the score from here, so it stays the same function all game. Reading the
  // state made it a new function on every point, which redrew the map mid-round and let the
  // last round's timer save the score from before its own point (KAN-83).
  const scoreRef = useRef(0);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // The game's questions, already shuffled and free of repeats (utils/gamePlan.js).
  // Rounds ask them in order.
  const streetsRef = useRef([]);
  const nextQuestionIndex = useRef(0);

  const getNextStreet = useCallback(() => {
    const street = streetsRef.current[nextQuestionIndex.current];
    if (!street) return null;
    nextQuestionIndex.current += 1;
    return street;
  }, []);

  const startNewRound = useCallback(() => {
    const newStreet = getNextStreet();
    if (!newStreet) {
      console.error('No streets available');
      return;
    }

    console.log('=== NEW ROUND ===');
    console.log('New street:', newStreet.name);
    setCurrentStreet(newStreet);
    setGameActive(true);
    setFeedback('');
  }, [getNextStreet]);

  const endGame = useCallback(() => {
    setGameMode('gameOver');
    setFinalScore(scoreRef.current);
    setGameActive(false);
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setRound(1);
    setFinalScore(0);
    setFeedback('');
    // Without this, the previous game's last street shows as round 1 until the new round starts
    setCurrentStreet(null);
    nextQuestionIndex.current = 0;
  }, []);

  const updateStreetsRef = useCallback((questions) => {
    streetsRef.current = questions ?? [];
    nextQuestionIndex.current = 0;
  }, []);

  return {
    // State
    gameMode,
    score,
    round,
    currentStreet,
    gameActive,
    feedback,
    finalScore,
    streetsRef,

    // Setters
    setGameMode,
    setScore,
    setRound,
    setCurrentStreet,
    setGameActive,
    setFeedback,
    setFinalScore,

    // Functions
    getNextStreet,
    startNewRound,
    endGame,
    resetGame,
    updateStreetsRef,
  };
}
