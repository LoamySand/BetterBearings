import { useState, useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';
import SaveStreetSetModal from './SaveStreetSetModal';
import './CreateStreetSetModal.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

export default function CreateStreetSetModal({ onClose, onSave, mapRef }) {
  const [step, setStep] = useState('selectArea'); // 'selectArea' or 'savingSet'
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [quizCenter, setQuizCenter] = useState(null);
  const [quizRadius, setQuizRadius] = useState(null);
  const mapInstanceRef = useRef(null);

  // Difficulty map
  const difficultyMap = {
    'easy': Difficulty.Tourist,
    'medium': Difficulty.Resident,
    'hard': Difficulty.TaxiDriver,
  };

  // Load streets based on difficulty
  const { streets, loading, error, loadStreets } = useOverpassStreets({
    center: step === 'savingSet' && quizCenter ? quizCenter : null,
    radius: quizRadius,
    shape: PresetAreaShape.Circle,
    difficulty: difficultyMap[selectedDifficulty],
    numberOfQuestions: 200, // Fetch up to 200 streets for better selection
  });

  // Trigger street loading when user selects area and moves to saving step
  useEffect(() => {
    if (step === 'savingSet' && quizCenter && quizRadius && !loading && streets.length === 0) {
      console.log('Loading streets for creating street set...');
      loadStreets();
    }
  }, [step, quizCenter, quizRadius, loadStreets, loading, streets.length]);

  // Initialize map
  useEffect(() => {
    if (!mapRef?.current || mapInstanceRef.current) {
      return;
    }

    let checkInterval;
    const initMap = () => {
      if (!window.L) {
        return;
      }

      try {
        const map = window.L.map(mapRef.current).setView([40, -95], 4);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        
        mapInstanceRef.current = map;
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
      alert('Map not initialized. Please try again.');
      return;
    }

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
  };

  const handleSaveStreetSet = async (config) => {
    // Streets from Overpass API already have 'points' field in format [{lat, lng}, ...]
    // No need to convert - just use them directly
    const convertedStreets = streets.map(street => ({
      ...street,
      // Points are already in the correct format from Overpass API
      points: street.points || [],
    }));

    await onSave({
      name: config.name,
      description: config.description,
      center: quizCenter,
      radius: quizRadius,
      streets: convertedStreets,
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
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSelectArea}
              className="btn-select"
            >
              <MapPin size={18} />
              Select Area & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
