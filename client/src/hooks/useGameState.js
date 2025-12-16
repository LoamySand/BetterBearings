import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook to manage game state and logic
 */
export function useGameState(totalRounds = 5) {
  const [gameMode, setGameMode] = useState('selecting');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStreet, setCurrentStreet] = useState(null);
  const [gameActive, setGameActive] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  const streetsRef = useRef([]);
  const usedStreetIndices = useRef(new Set());

  const getRandomStreet = useCallback(() => {
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
  }, []);

  const startNewRound = useCallback(() => {
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
  }, [getRandomStreet]);

  const endGame = useCallback(() => {
    setGameMode('gameOver');
    setFinalScore(score);
    setGameActive(false);
  }, [score]);

  const resetGame = useCallback(() => {
    setScore(0);
    setRound(1);
    setFinalScore(0);
    setFeedback('');
    usedStreetIndices.current.clear();
  }, []);

  const updateStreetsRef = useCallback((streets) => {
    if (streets && streets.length > 0) {
      streetsRef.current = streets;
      usedStreetIndices.current.clear();
      console.log('Streets loaded:', streets.length);
    }
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
    usedStreetIndices,
    
    // Setters
    setGameMode,
    setScore,
    setRound,
    setCurrentStreet,
    setGameActive,
    setFeedback,
    setFinalScore,
    
    // Functions
    getRandomStreet,
    startNewRound,
    endGame,
    resetGame,
    updateStreetsRef,
  };
}
