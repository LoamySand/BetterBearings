import { useId, useState } from 'react';
import { Play, MapPin, X } from 'lucide-react';
import { maxQuestionsFor } from '../utils/gamePlan';
import './QuizAreaModule.css';

const CURRENT_LOCATION_MAX = 10;

const LEVEL_OPTIONS = [
  { value: 'easy', label: 'Easy', roads: 'Major roads' },
  { value: 'medium', label: 'Medium', roads: '+ Tertiary roads' },
  { value: 'hard', label: 'Hard', roads: 'All roads' },
];

export default function QuizAreaModule({
  streetSets,
  initialStreetSetId = null,
  onQuizStart,
  onSelectionChange,
  onClose,
  mapCenter,
  mapRadius,
}) {
  // Play This Set opens this panel with its set already chosen
  const [selectedStreetSet, setSelectedStreetSet] = useState(() =>
    initialStreetSetId ? String(initialStreetSetId) : 'current-location'
  );
  // Play This Set starts on Hard, which plays the whole set; Current Location starts on Easy
  const [difficulty, setDifficulty] = useState(initialStreetSetId ? 'hard' : 'easy');
  const [numQuestions, setNumQuestions] = useState(5);
  const ids = useId();
  const setId = `${ids}-set`;
  const difficultyId = `${ids}-difficulty`;
  const countId = `${ids}-count`;
  const countLabelId = `${ids}-count-label`;

  // GET /api/street-sets already returns includedStreets per set, so no fetch is needed.
  // Ids are bigint (strings from node-pg) and <select> values are strings; String() keeps it safe.
  const isCurrentLocation = selectedStreetSet === 'current-location';
  const selectedSet = streetSets.find((set) => String(set.id) === selectedStreetSet);
  // A saved set plays only the streets at or below the chosen level (KAN-73)
  const streetsAt = (level) =>
    selectedSet?.includedByLevel?.[level] ?? selectedSet?.includedStreets ?? 0;
  // A set's pool must be at least 2x the questions, so it allows half its streets at this level
  const maxQuestions = isCurrentLocation
    ? CURRENT_LOCATION_MAX
    : maxQuestionsFor(streetsAt(difficulty));
  const levelLabel = LEVEL_OPTIONS.find((o) => o.value === difficulty)?.label;
  const setStillLoading = !isCurrentLocation && !selectedSet;
  const canPlay = isCurrentLocation || (!setStillLoading && maxQuestions >= 1);
  const sliderMax = Math.max(maxQuestions, 1);
  // Switching to a smaller set shouldn't leave the count above its new maximum
  const questions = Math.min(numQuestions, sliderMax);

  const handlePlay = () => {
    onQuizStart({
      streetSet: selectedStreetSet,
      difficulty,
      numQuestions: questions,
      center: mapCenter,
      radius: mapRadius,
    });
  };

  return (
    <div className="quiz-area-module">
      <div className="quiz-module-header">
        <MapPin size={24} aria-hidden="true" />
        <h2>Quiz This Area</h2>
        {/* Shown only on phones, where the panel is a bottom sheet (Game.css) */}
        {onClose && (
          <button
            type="button"
            className="quiz-close"
            onClick={onClose}
            aria-label="Close quiz panel"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="quiz-module-content">
        {/* Street Set Selector */}
        <div className="form-group">
          <label htmlFor={setId}>Street Set</label>
          <select
            id={setId}
            value={selectedStreetSet}
            onChange={(e) => {
              setSelectedStreetSet(e.target.value);
              // Game shows the quiz circle only for Current Location
              onSelectionChange?.(e.target.value === 'current-location');
            }}
            className="form-select"
          >
            <option value="current-location">📍 Current Location</option>
            {streetSets.map((set) => (
              <option key={set.id} value={set.id}>
                📚 {set.name}
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty Selector */}
        <div className="form-group">
          <label htmlFor={difficultyId}>Difficulty</label>
          <select
            id={difficultyId}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="form-select"
          >
            {LEVEL_OPTIONS.map(({ value, label, roads }) => (
              <option key={value} value={value}>
                {label} ({roads}
                {selectedSet ? `, ${streetsAt(value)} streets` : ''})
              </option>
            ))}
          </select>
        </div>

        {/* Number of Questions */}
        <div className="form-group">
          <div className="count-label-row">
            <label htmlFor={countId} id={countLabelId}>
              Number of Questions
            </label>
            <span className="number-max" aria-hidden="true">
              max {sliderMax}
            </span>
          </div>
          <div className="number-input-group">
            <input
              id={countId}
              type="number"
              min="1"
              max={sliderMax}
              value={questions}
              disabled={!canPlay}
              onChange={(e) =>
                setNumQuestions(Math.min(Math.max(1, parseInt(e.target.value) || 1), sliderMax))
              }
              className="number-input"
            />
            <input
              type="range"
              aria-labelledby={countLabelId}
              min="1"
              max={sliderMax}
              value={questions}
              disabled={!canPlay}
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
              className="number-slider"
            />
          </div>
          {setStillLoading && <p className="quiz-note">Loading your street sets...</p>}
          {!setStillLoading && !canPlay && (
            <p className="quiz-note">
              {maxQuestionsFor(selectedSet?.includedStreets || 0) >= 1
                ? `This set has fewer than 2 streets at ${levelLabel}. Pick a harder level.`
                : 'This set needs at least 2 included streets to play.'}
            </p>
          )}
        </div>

        {/* Play Button */}
        <button onClick={handlePlay} className="btn-play" disabled={!canPlay}>
          <Play size={20} />
          Play
        </button>
      </div>

      <p className="quiz-instruction">
        Pan and zoom to move the circle. Streets inside it are quizzed.
      </p>
    </div>
  );
}
