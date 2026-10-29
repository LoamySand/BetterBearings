import { useState, useEffect } from 'react';
import { Play, MapPin } from 'lucide-react';
import './QuizAreaModule.css';
import { API_URL } from '../config';

export default function QuizAreaModule({ 
  streetSets, 
  onQuizStart,
  mapCenter, 
  mapRadius 
}) {
  const [selectedStreetSet, setSelectedStreetSet] = useState('current-location');
  const [difficulty, setDifficulty] = useState('easy');
  const [numQuestions, setNumQuestions] = useState(5);
  const [maxQuestions, setMaxQuestions] = useState(10);

  // Update max questions based on selected street set
  useEffect(() => {
    if (selectedStreetSet === 'current-location') {
      setMaxQuestions(10);
      console.log('QuizAreaModule: Current Location selected, maxQuestions set to 10');
    } else {
      // Fetch the full street set to get the streets count
      const fetchStreetSetDetails = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_URL}/street-sets/${selectedStreetSet}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const set = await response.json();
            // Only count included streets
            const includedStreets = set.streets?.filter(s => s.included !== false) || [];
            const streetCount = includedStreets.length || 10;
            setMaxQuestions(Math.max(streetCount, 1));
            console.log(`QuizAreaModule: Street set "${set.name}" selected, ${includedStreets.length} included streets, maxQuestions set to ${streetCount}`);
          }
        } catch (err) {
          console.error('Failed to fetch street set details:', err);
          setMaxQuestions(10); // Fallback
        }
      };

      fetchStreetSetDetails();
    }
  }, [selectedStreetSet]);

  const handlePlay = () => {
    onQuizStart({
      streetSet: selectedStreetSet,
      difficulty,
      numQuestions,
      center: mapCenter,
      radius: mapRadius,
    });
  };

  return (
    <div className="quiz-area-module">
      <div className="quiz-module-header">
        <MapPin size={24} />
        <h2>Quiz This Area</h2>
      </div>

      <div className="quiz-module-content">
            {/* Street Set Selector */}
            <div className="form-group">
              <label>Street Set</label>
              <select 
                value={selectedStreetSet} 
                onChange={(e) => setSelectedStreetSet(e.target.value)}
                className="form-select"
              >
                <option value="current-location">📍 Current Location</option>
                {streetSets.map(set => (
                  <option key={set._id} value={set._id}>
                    📚 {set.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Selector */}
            <div className="form-group">
              <label>Difficulty</label>
              <select 
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
              <label>Number of Questions</label>
              <div className="number-input-group">
                <input 
                  type="number"
                  min="1"
                  max={maxQuestions}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxQuestions))}
                  className="number-input"
                />
                <input 
                  type="range"
                  min="1"
                  max={maxQuestions}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className="number-slider"
                />
                <span className="number-max">/ {maxQuestions}</span>
              </div>
            </div>

            {/* Play Button */}
            <button onClick={handlePlay} className="btn-play">
              <Play size={20} />
              Play
            </button>
      </div>

      <p className="quiz-instruction">Pan and zoom the map to select your quiz area</p>
    </div>
  );
}
