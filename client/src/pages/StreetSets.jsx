import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, MapPin, Trash2, Eye, Play } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import CreateStreetSetModal from '../components/CreateStreetSetModal';
import './StreetSets.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

export default function StreetSets() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [streetSets, setStreetSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchStreetSets();
  }, [isAuthenticated, navigate]);

  const fetchStreetSets = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch street sets');
      }

      const data = await response.json();
      setStreetSets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this street set?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete street set');
      }

      setStreetSets(streetSets.filter(set => set._id !== id));
    } catch (err) {
      alert('Error deleting street set: ' + err.message);
    }
  };

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleSaveStreetSet = async (streetSetData) => {
    try {
      const token = localStorage.getItem('authToken');
      
      console.log('handleSaveStreetSet called with:', streetSetData);
      console.log('First street in streetSetData:', streetSetData.streets[0]);
      console.log('First street points:', streetSetData.streets[0]?.points);
      
      // Map difficulty string to numeric value
      const difficultyMap = {
        'easy': 1,
        'medium': 2,
        'hard': 3,
      };
      const difficultyLevel = difficultyMap[streetSetData.difficulty] || 2;
      
      // Prepare streets for saving
      const streetsToSave = streetSetData.streets.map(street => {
        if (!street.points || !Array.isArray(street.points)) {
          console.warn('Street missing points:', street.name, 'points:', street.points);
          return null;
        }
        
        console.log(`Converting street "${street.name}", points length:`, street.points.length, 'first point:', street.points[0]);
        
        return {
          osmId: street.osmId,
          name: street.name,
          // Convert from [{lat, lng}, ...] to [[lat, lng], ...]
          coordinates: street.points.map(polyline => 
            Array.isArray(polyline) ? polyline.map(point => [point.lat, point.lng]) : []
          ),
          type: street.type,
          length: street.length,
          width: street.width,
          alternativeName: street.alternativeName,
          isEnclosedArea: street.isEnclosedArea,
          included: true,
          difficulty: difficultyLevel, // Use the selected difficulty level
        };
      }).filter(s => s !== null);

      console.log('Streets to save:', streetsToSave[0]);

      const response = await fetch(`${API_URL}/street-sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: streetSetData.name,
          description: streetSetData.description,
          center: streetSetData.center,
          radius: streetSetData.radius,
          streets: streetsToSave,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save street set');
      }

      const savedSet = await response.json();
      setShowCreateModal(false);
      
      // Navigate to StreetSetDetail editor
      navigate(`/street-sets/${savedSet._id}`);
    } catch (err) {
      alert('Error saving street set: ' + err.message);
      throw err;
    }
  };

  const handlePlay = async (streetSet) => {
    try {
      // Fetch full street set data including streets
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets/${streetSet._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load street set details');
      }

      const fullStreetSet = await response.json();
      
      if (!fullStreetSet.streets || fullStreetSet.streets.length === 0) {
        alert('This street set has no streets to play with.');
        return;
      }
      
      navigate('/', { 
        state: { 
          streetSet: {
            name: fullStreetSet.name,
            center: fullStreetSet.center,
            radius: fullStreetSet.radius,
            streets: fullStreetSet.streets.filter(s => s.included).map(s => ({
              name: s.name,
              // Convert coordinates array format [[lat, lng], ...] back to points format [{lat, lng}, ...]
              points: s.coordinates.map(polyline => 
                polyline.map(coord => {
                  // Handle both [lat, lng] array format and {lat, lng} object format
                  if (Array.isArray(coord)) {
                    return { lat: coord[0], lng: coord[1] };
                  }
                  return coord; // Already in {lat, lng} format
                })
              ),
              osmId: s.osmId,
              type: s.type,
              length: s.length,
              width: s.width,
              alternativeName: s.alternativeName,
              isEnclosedArea: s.isEnclosedArea || false
            }))
          }
        } 
      });
    } catch (err) {
      alert('Error loading street set: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="street-sets-page">
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <AppHeader onSignIn={() => setShowAuthModal(true)} />
        <div className="street-sets-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="street-sets-page">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showCreateModal && (
        <CreateStreetSetModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveStreetSet}
          mapRef={mapRef}
        />
      )}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      
      <div className="street-sets-header">
        <div className="header-content">
          <h1>My Street Sets</h1>
          <p className="subtitle">Manage your custom street collections</p>
        </div>
        <button className="btn-create-new" onClick={handleCreateNew}>
          <Plus size={20} />
          Create New Set
        </button>
      </div>

      <div className="street-sets-container">
        {error && <div className="error-message">{error}</div>}

        {streetSets.length === 0 ? (
          <div className="empty-state">
            <MapPin size={64} className="empty-icon" />
            <h2>No Street Sets Yet</h2>
            <p>Create your first street set by playing a quiz area and saving it!</p>
            <button className="btn-create-new" onClick={handleCreateNew}>
              <Plus size={20} />
              Get Started
            </button>
          </div>
        ) : (
          <div className="street-sets-grid">
            {streetSets.map((set) => (
              <div key={set._id} className="street-set-card">
                <div className="card-header">
                  <h3>{set.name}</h3>
                  <div className="card-actions">
                    <button
                      className="btn-icon"
                      onClick={() => navigate(`/street-sets/${set._id}`)}
                      title="View details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDelete(set._id)}
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {set.description && (
                  <p className="card-description">{set.description}</p>
                )}

                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-label">Total Streets</span>
                    <span className="stat-value">{set.totalStreets}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Included</span>
                    <span className="stat-value">{set.includedStreets}</span>
                  </div>
                </div>

                <div className="card-footer">
                  <MapPin size={14} />
                  <span className="location-text">
                    {set.center.lat.toFixed(4)}, {set.center.lng.toFixed(4)}
                  </span>
                </div>

                <button 
                  className="btn-play"
                  onClick={() => handlePlay(set)}
                >
                  <Play size={20} />
                  Play This Set
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

