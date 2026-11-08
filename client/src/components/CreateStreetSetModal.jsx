import { useState, useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { useStreets } from '../hooks/useStreets';
import { Difficulty } from '../utils/areaTypes';
import SaveStreetSetModal from './SaveStreetSetModal';
import './CreateStreetSetModal.css';
import { addBaseLayer } from '../utils/tileLayer';

export default function CreateStreetSetModal({ onClose, onSave }) {
  const [step, setStep] = useState('selectArea'); // 'selectArea' or 'savingSet'
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [quizCenter, setQuizCenter] = useState(null);
  const [quizRadius, setQuizRadius] = useState(null);
  const mapRef = useRef(null); // Create the ref inside the component
  const mapInstanceRef = useRef(null);

  // Difficulty map
  const difficultyMap = {
    easy: Difficulty.Tourist,
    medium: Difficulty.Resident,
    hard: Difficulty.TaxiDriver,
  };

  // Load streets based on difficulty
  const { streets, loading, error, loadStreets } = useStreets({
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

  // Initialize map
  useEffect(() => {
    if (!mapRef?.current) {
      console.log('Map ref not ready yet');
      return;
    }

    // Check if map is already initialized
    if (mapRef.current._leaflet_id) {
      console.log('Map already initialized');
      return;
    }

    let checkInterval;
    const initMap = () => {
      if (!window.L) {
        console.log('Leaflet not loaded yet');
        return;
      }

      try {
        // Ensure the container exists and is in the DOM
        if (!mapRef.current || !document.body.contains(mapRef.current)) {
          console.log('Container not in DOM yet');
          return;
        }

        console.log('Initializing map...');
        const map = window.L.map(mapRef.current).setView([40, -95], 4);
        addBaseLayer(map);

        mapInstanceRef.current = map;
        console.log('Map initialized successfully');
        clearInterval(checkInterval);
      } catch (err) {
        console.error('Error initializing map:', err);
      }
    };

    initMap();
    checkInterval = setInterval(initMap, 100);

    return () => clearInterval(checkInterval);
  }, [mapRef]);

  const handleSelectArea = () => {
    if (!mapInstanceRef.current) {
      console.error('Map instance not initialized:', mapInstanceRef.current);
      alert('Map not initialized. Please wait a moment and try again.');
      return;
    }

    try {
      const map = mapInstanceRef.current;
      const bounds = map.getBounds();
      const center = bounds.getCenter();

      // Calculate radius from bounds
      const maxDist = Math.max(
        map.distance(center, bounds.getNorthWest()),
        map.distance(center, bounds.getNorthEast()),
        map.distance(center, bounds.getSouthWest()),
        map.distance(center, bounds.getSouthEast())
      );

      const radius = Math.min(maxDist, 5000);

      if (radius < 500) {
        alert('Area too small. Please zoom out more.');
        return;
      }

      setQuizCenter({ lat: center.lat, lng: center.lng });
      setQuizRadius(radius);
      setStep('savingSet');
    } catch (err) {
      console.error('Error selecting area:', err);
      alert('Error selecting area. Please try again.');
    }
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
        error={error}
      />
    );
  }

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2>Create New Street Set</h2>
        <p className="modal-subtitle">Select a difficulty level and area</p>

        <div className="create-modal-content">
          {/* Difficulty Selector */}
          <div className="form-group">
            <label htmlFor="difficulty">Difficulty Level</label>
            <select
              id="difficulty"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="form-select"
            >
              <option value="easy">Easy (Major roads)</option>
              <option value="medium">Medium (+ Tertiary roads)</option>
              <option value="hard">Hard (All roads)</option>
            </select>
          </div>

          {/* Map Container */}
          <div className="map-container">
            <div ref={mapRef} className="create-map" />
            <p className="map-instruction">Pan and zoom to select your area</p>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="button" onClick={handleSelectArea} className="btn-select">
              <MapPin size={18} />
              Select Area & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
