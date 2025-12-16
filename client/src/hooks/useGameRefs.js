import { useRef, useEffect } from 'react';

/**
 * Custom hook to manage and sync game refs with state
 */
export function useGameRefs(gameActive, currentStreet, gameMode, round) {
  const gameActiveRef = useRef(false);
  const currentStreetRef = useRef(null);
  const gameOverRef = useRef(false);
  const roundRef = useRef(1);

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

  return {
    gameActiveRef,
    currentStreetRef,
    gameOverRef,
    roundRef,
  };
}
