import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, MapPin, Trash2, Eye } from 'lucide-react';
import './StreetSets.css';

export default function StreetSets() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [streetSets, setStreetSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/street-sets`, {
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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/street-sets/${id}`, {
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
    navigate('/');
  };

  if (loading) {
    return (
      <div className="street-sets-page">
        <div className="street-sets-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="street-sets-page">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

