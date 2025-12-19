import { useState, useEffect } from 'react';
import { Play, MapPin } from 'lucide-react';
import './QuizAreaModule.css';

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
    } else {
      // Get the selected set's street count
      const set = streetSets.find(s => s._id === selectedStreetSet);
      if (set) {
        setMaxQuestions(Math.max(set.streets?.length || 10, 1));
      }
    }
  }, [selectedStreetSet, streetSets]);

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
