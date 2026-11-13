import { useState, useEffect, useCallback } from 'react';
import { X, MapPin } from 'lucide-react';
import { describeStreetError } from '../utils/streetErrors';
import { useStreets } from '../hooks/useStreets';
import { Difficulty } from '../utils/areaTypes';
import SaveStreetSetModal from './SaveStreetSetModal';
import './CreateStreetSetModal.css';
import { addBaseLayer } from '../utils/tileLayer';
import useDialog from '../hooks/useDialog';
import { useQuizCircle } from '../hooks/useQuizCircle';
import { quizAreaFor } from '../utils/quizArea';

// Same opening view as the game's selection map (useLeafletMap)
const START_CENTER = [35.0844, -106.6504];
const START_ZOOM = 11.5;

// The modal has room for one line: title and message together (KAN-63)
const streetErrorText = (kind, message) => {
  const { title, message: detail } = describeStreetError({ kind, message });
  return `${title}. ${detail}`;
};

export default function CreateStreetSetModal({ onClose, onSave }) {
  const [step, setStep] = useState('selectArea'); // 'selectArea' or 'savingSet'
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [quizCenter, setQuizCenter] = useState(null);
  const [quizRadius, setQuizRadius] = useState(null);
  // The map lives in state so the quiz circle can draw on it, and so it's gone once removed
  const [map, setMap] = useState(null);
  const [tooSmall, setTooSmall] = useState(false);
  const { titleId, dialogProps } = useDialog(onClose);

  // Difficulty map
  const difficultyMap = {
    easy: Difficulty.Tourist,
    medium: Difficulty.Resident,
    hard: Difficulty.TaxiDriver,
  };

  // Load streets based on difficulty
  const { streets, loading, error, errorKind, loadStreets } = useStreets({
    center: step === 'savingSet' && quizCenter ? quizCenter : null,
    radius: quizRadius,
    difficulty: difficultyMap[selectedDifficulty],
    numberOfQuestions: 200, // the street-set cap
  });

  // Load once on reaching the saving step. Without the !error guard, a failed load (429, 503)
  // left streets empty and re-triggered this effect in a loop.
  useEffect(() => {
    if (step === 'savingSet' && quizCenter && quizRadius && !loading && !error && !streets.length) {
      loadStreets();
    }
  }, [step, quizCenter, quizRadius, loadStreets, loading, error, streets.length]);

  // One map per mounted container (KAN-62). A callback ref runs when the div mounts and its
  // cleanup when it unmounts (React 19), so the map can't outlive the div or be created twice
  // on it. The old effect polled every 100 ms and never stopped, calling L.map() on a container
  // Leaflet already owned: "Map container is already initialized" 10 times a second.
  const mapContainerRef = useCallback((el) => {
    if (!el) return undefined;
    const created = window.L.map(el, { center: START_CENTER, zoom: START_ZOOM, zoomControl: true });
    addBaseLayer(created);
    const check = () => setTooSmall(quizAreaFor(created).tooSmall);
    created.on('moveend zoomend resize', check);
    check();
    setMap(created);
    return () => {
      created.off('moveend zoomend resize', check);
      created.remove();
      setMap(null);
    };
  }, []);

  // The circle shows exactly the area Select Area saves, the same as the game's (KAN-76)
  useQuizCircle({ map, active: step === 'selectArea' });

  const handleSelectArea = () => {
    if (!map) return;
    const area = quizAreaFor(map);
    // The button is disabled while the circle is red; this only guards a race with a zoom
    if (area.tooSmall) return;
    setQuizCenter(area.center);
    setQuizRadius(area.radius);
    setStep('savingSet');
  };

  const handleSaveStreetSet = async (config) => {
    // useStreets already returns points as lines of { lat, lng }
    await onSave({
      name: config.name,
      description: config.description,
      center: quizCenter,
      radius: quizRadius,
      streets,
      difficulty: selectedDifficulty, // Pass the selected difficulty
    });
  };

  if (step === 'savingSet') {
    return (
      <SaveStreetSetModal
        onClose={onClose}
        onSave={handleSaveStreetSet}
        streets={streets}
        center={quizCenter}
        radius={quizRadius}
        isCreating={true}
        loading={loading}
        error={error && streetErrorText(errorKind, error)}
      />
    );
  }

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" {...dialogProps} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="create-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <h2 id={titleId}>Create New Street Set</h2>
        <p className="create-modal-subtitle">Select a difficulty level and area</p>

        <div className="create-modal-content">
          {/* Difficulty Selector */}
          <div className="create-field">
            <label htmlFor="difficulty">Difficulty Level</label>
            <select
              id="difficulty"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="create-select"
            >
              <option value="easy">Easy (Major roads)</option>
              <option value="medium">Medium (+ Tertiary roads)</option>
              <option value="hard">Hard (All roads)</option>
            </select>
          </div>

          {/* Map Container */}
          <div className="map-container">
            <div ref={mapContainerRef} className="create-map" />
            <p className="map-instruction">Pan and zoom until the circle covers your area</p>
          </div>

          {/* Actions */}
          <div className="create-modal-actions">
            <button type="button" onClick={onClose} className="create-cancel">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSelectArea}
              className="btn-select"
              disabled={!map || tooSmall}
            >
              <MapPin size={18} aria-hidden="true" />
              {tooSmall ? 'Zoom out to continue' : 'Select Area & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
