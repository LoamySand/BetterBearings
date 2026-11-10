import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, MapPin, Trash2, Eye, Play } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import CreateStreetSetModal from '../components/CreateStreetSetModal';
import './StreetSets.css';
import { API_URL } from '../config';

export default function StreetSets() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [streetSets, setStreetSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // On a direct load or refresh the stored token is still being checked; wait for it
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchStreetSets();
  }, [authLoading, isAuthenticated, navigate]);

  const fetchStreetSets = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets`, {
        headers: {
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete street set');
      }

      setStreetSets(streetSets.filter((set) => set.id !== id));
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

      // Prepare streets for saving
      const streetsToSave = streetSetData.streets
        .map((street) => {
          if (!street.points || !Array.isArray(street.points)) {
            console.warn('Street missing points:', street.name);
            return null;
          }

          return {
            osmId: street.osmId,
            name: street.name,
            // Convert from [{lat, lng}, ...] to [[lat, lng], ...]
            coordinates: street.points.map((polyline) =>
              Array.isArray(polyline) ? polyline.map((point) => [point.lat, point.lng]) : []
            ),
            type: street.type,
            length: street.length,
            width: street.width,
            alternativeName: street.alternativeName,
            isEnclosedArea: street.isEnclosedArea,
            included: true,
          };
        })
        .filter((s) => s !== null);

      const response = await fetch(`${API_URL}/street-sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: streetSetData.name,
          description: streetSetData.description,
          center: streetSetData.center,
          radius: streetSetData.radius,
          // The server labels each street from its road type (KAN-73)
          streets: streetsToSave,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save street set');
      }

      const savedSet = await response.json();
      setShowCreateModal(false);

      // Navigate to StreetSetDetail editor
      navigate(`/street-sets/${savedSet.id}`);
    } catch (err) {
      alert('Error saving street set: ' + err.message);
      throw err;
    }
  };

  // The quiz panel on / opens with this set selected, so the player picks the question count
  const handlePlay = (streetSet) => {
    navigate('/', { state: { streetSetId: streetSet.id } });
  };

  if (loading) {
    return (
      <div className="street-sets-page">
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <AppHeader onSignIn={() => setShowAuthModal(true)} />
        <main className="street-sets-container">
          <p>Loading...</p>
        </main>
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
        />
      )}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />

      <main>
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
              <MapPin size={64} className="empty-icon" aria-hidden="true" />
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
                <div key={set.id} className="street-set-card">
                  <div className="card-header">
                    <h2>{set.name}</h2>
                    <div className="card-actions">
                      <button
                        className="btn-icon"
                        onClick={() => navigate(`/street-sets/${set.id}`)}
                        title="View details"
                        aria-label={`View ${set.name}`}
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(set.id)}
                        title="Delete"
                        aria-label={`Delete ${set.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {set.description && <p className="card-description">{set.description}</p>}

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
                    <MapPin size={14} aria-hidden="true" />
                    <span className="location-text">
                      {set.center.lat.toFixed(4)}, {set.center.lng.toFixed(4)}
                    </span>
                  </div>

                  <button className="btn-play" onClick={() => handlePlay(set)}>
                    <Play size={20} />
                    Play This Set
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
