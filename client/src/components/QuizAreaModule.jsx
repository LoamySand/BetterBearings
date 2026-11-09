import { useId, useState } from 'react';
import { Play, MapPin } from 'lucide-react';
import { maxQuestionsFor } from '../utils/gamePlan';
import './QuizAreaModule.css';

const CURRENT_LOCATION_MAX = 10;

export default function QuizAreaModule({
  streetSets,
  initialStreetSetId = null,
  onQuizStart,
  mapCenter,
  mapRadius,
}) {
  // Play This Set opens this panel with its set already chosen
  const [selectedStreetSet, setSelectedStreetSet] = useState(() =>
    initialStreetSetId ? String(initialStreetSetId) : 'current-location'
  );
  const [difficulty, setDifficulty] = useState('easy');
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
  // A set's pool must be at least 2x the questions, so it allows half its included streets
  const maxQuestions = isCurrentLocation
    ? CURRENT_LOCATION_MAX
    : maxQuestionsFor(selectedSet?.includedStreets || 0);
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
      </div>

      <div className="quiz-module-content">
        {/* Street Set Selector */}
        <div className="form-group">
          <label htmlFor={setId}>Street Set</label>
          <select
            id={setId}
            value={selectedStreetSet}
            onChange={(e) => setSelectedStreetSet(e.target.value)}
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
            <option value="easy">Easy (Major roads)</option>
            <option value="medium">Medium (+ Tertiary roads)</option>
            <option value="hard">Hard (All roads)</option>
          </select>
        </div>

        {/* Number of Questions */}
        <div className="form-group">
          <label htmlFor={countId} id={countLabelId}>
            Number of Questions
          </label>
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
            <span className="number-max" aria-hidden="true">
              / {sliderMax}
            </span>
          </div>
          {setStillLoading && <p className="quiz-note">Loading your street sets...</p>}
          {!setStillLoading && !canPlay && (
            <p className="quiz-note">This set needs at least 2 included streets to play.</p>
          )}
        </div>

        {/* Play Button */}
        <button onClick={handlePlay} className="btn-play" disabled={!canPlay}>
          <Play size={20} />
          Play
        </button>
      </div>

      <p className="quiz-instruction">Pan and zoom the map to select your quiz area</p>
    </div>
  );
}
