import React, { useState } from 'react';
import { useOverpassStreets } from '../hooks/useOverpassStreets';
import { Difficulty, PresetAreaShape } from '../utils/areaTypes';

/**
 * Example component demonstrating the new Overpass-based street fetching
 */
export default function OverpassGameExample() {
  const [center, setCenter] = useState({ lat: 35.0844, lng: -106.6504 });
  const [radius, setRadius] = useState(5000);
  const [difficulty, setDifficulty] = useState(Difficulty.Tourist);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  
  const { 
    streets, 
    loading, 
    error, 
    loadStreets 
  } = useOverpassStreets({
    center,
    radius,
    shape: PresetAreaShape.Circle,
    difficulty,
    numberOfQuestions
  });
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Overpass Street Fetcher Demo</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Settings</h2>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Center Latitude: 
            <input 
              type="number" 
              value={center.lat} 
              onChange={(e) => setCenter({ ...center, lat: parseFloat(e.target.value) })}
              step="0.0001"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Center Longitude: 
            <input 
              type="number" 
              value={center.lng} 
              onChange={(e) => setCenter({ ...center, lng: parseFloat(e.target.value) })}
              step="0.0001"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Radius (meters): 
            <input 
              type="number" 
              value={radius} 
              onChange={(e) => setRadius(parseInt(e.target.value))}
              step="1000"
              min="1000"
              max="20000"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Difficulty: 
            <select 
              value={difficulty} 
              onChange={(e) => setDifficulty(e.target.value)}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value={Difficulty.Tourist}>Tourist (Major roads)</option>
              <option value={Difficulty.Resident}>Resident (+ Tertiary roads)</option>
              <option value={Difficulty.TaxiDriver}>Taxi Driver (All roads)</option>
            </select>
          </label>
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <label>
            Number of Streets: 
            <input 
              type="number" 
              value={numberOfQuestions} 
              onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
              min="1"
              max="50"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>
        
        <button 
          onClick={loadStreets}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            background: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Fetch Streets'}
        </button>
      </div>
      
      {error && (
        <div style={{ 
          padding: '15px', 
          background: '#fee', 
          color: '#c00', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Fetching streets from Overpass API...</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            This may take 10-30 seconds for the first fetch. Subsequent fetches use cached data.
          </p>
        </div>
      )}
      
      {streets.length > 0 && !loading && (
        <div>
          <h2>Results ({streets.length} streets)</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {streets.map((street, index) => (
              <li 
                key={index}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              >
                <strong>{street.name}</strong>
                {street.alternativeName && (
                  <span style={{ color: '#666', marginLeft: '10px' }}>
                    ({street.alternativeName})
                  </span>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  {street.points.length} segment(s) · 
                  {street.isEnclosedArea ? ' Enclosed area' : ' Polyline'}
                  {street.width && ` · Width: ${street.width.toFixed(1)}m`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
