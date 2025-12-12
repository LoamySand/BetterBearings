import { useState, useEffect } from 'react';
import { streetAPI } from '../services/api';

export default function AdminPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('Albuquerque');
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const response = await streetAPI.getCities();
      setCities(response.data);
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  };

  const uploadGeoJSON = async () => {
    if (!file) {
      alert('Please select a GeoJSON file');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log(`Uploading ${file.name} for ${selectedCity}...`);

      const response = await fetch(
        `http://localhost:5000/api/streets/import-geojson/${selectedCity}`,

        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        alert(
          `✅ Success!\n\nImported ${data.uniqueStreets} unique streets\n${data.totalSegments} total segments\n\nFor: ${selectedCity}`
        );
        setFile(null);
        loadCities();
      } else {
        alert(`❌ Error: ${data.message || 'Import failed'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Error uploading file: ' + error.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const getCityStats = async () => {
    try {
      const response = await streetAPI.getCityStats(selectedCity);
      setResult(response.data);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const deleteCity = async () => {
    if (!window.confirm(`⚠️ Delete ALL streets for ${selectedCity}?\n\nThis cannot be undone!`))
      return;

    try {
      await streetAPI.deleteCity(selectedCity);
      alert(`✅ Deleted all streets for ${selectedCity}`);
      loadCities();
      setResult(null);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🗺️ Street Data Management</h1>

      {/* City Selector */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          background: '#f3f4f6',
          borderRadius: '8px',
        }}
      >
        <h3>Select City</h3>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            minWidth: '250px',
            borderRadius: '8px',
            border: '2px solid #d1d5db',
          }}
        >
          <option value="Albuquerque">Albuquerque, NM</option>
          <option value="Santa Fe">Santa Fe, NM</option>
          <option value="Las Cruces">Las Cruces, NM</option>
          <option value="Phoenix">Phoenix, AZ</option>
          <option value="Denver">Denver, CO</option>
          <option value="Los Angeles">Los Angeles, CA</option>
          <option value="San Francisco">San Francisco, CA</option>
          <option value="Seattle">Seattle, WA</option>
          <option value="Portland">Portland, OR</option>
          <option value="Austin">Austin, TX</option>
          <option value="Dallas">Dallas, TX</option>
          <option value="Houston">Houston, TX</option>
        </select>
      </div>

      {/* GeoJSON Upload */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          color: 'white',
        }}
      >
        <h3 style={{ marginTop: 0, color: 'white' }}>📤 Upload GeoJSON for {selectedCity}</h3>

        <div
          style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Step 1:</strong> Download GeoJSON from USDOT
          </p>
          <a
            href="https://geodata.bts.gov/datasets/usdot::north-american-roads/about"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#fcd34d',
              textDecoration: 'underline',
              fontSize: '0.9rem',
            }}
          >
            → USDOT North American Roads Dataset
          </a>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
            💡 Tip: Filter by state (e.g., &quot;New Mexico&quot;) before downloading to get a
            smaller file
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
            <strong>Step 2:</strong> Select the downloaded file
          </p>
          <input
            type="file"
            accept=".geojson,.json"
            onChange={(e) => setFile(e.target.files[0])}
            style={{
              padding: '0.5rem',
              background: 'white',
              borderRadius: '8px',
              width: '100%',
              cursor: 'pointer',
            }}
          />
          {file && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              ✓ Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <button
          onClick={uploadGeoJSON}
          disabled={loading || !file}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            background: file ? '#10B981' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading || !file ? 'not-allowed' : 'pointer',
            width: '100%',
            fontWeight: 'bold',
            transition: 'all 0.3s',
          }}
        >
          {loading ? '⏳ Uploading and Processing...' : '🚀 Upload and Import to MongoDB'}
        </button>

        {loading && (
          <p style={{ margin: '1rem 0 0 0', textAlign: 'center', fontSize: '0.9rem' }}>
            This may take a few minutes for large files...
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          onClick={getCityStats}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            background: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            flex: 1,
            minWidth: '200px',
          }}
        >
          📊 View Stats for {selectedCity}
        </button>

        <button
          onClick={deleteCity}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            background: '#EF4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            flex: 1,
            minWidth: '200px',
          }}
        >
          🗑️ Delete {selectedCity} Streets
        </button>
      </div>

      {/* Database Cities */}
      {cities.length > 0 && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1rem',
            background: '#f3f4f6',
            borderRadius: '8px',
          }}
        >
          <h3>Cities in Database</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {cities.map((city) => (
              <div
                key={city.name}
                style={{
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '8px',
                  border: city.name === selectedCity ? '2px solid #667eea' : '1px solid #e5e7eb',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{city.name}</strong>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {city.streetCount} segments
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div
          style={{
            background: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            maxHeight: '500px',
            overflow: 'auto',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Result</h3>
          <pre
            style={{
              fontSize: '0.875rem',
              background: 'white',
              padding: '1rem',
              borderRadius: '8px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
