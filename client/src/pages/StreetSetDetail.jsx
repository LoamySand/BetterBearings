import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, CheckSquare, Square, Play, Star } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import './StreetSetDetail.css';

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

export default function StreetSetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [streetSet, setStreetSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectAll, setSelectAll] = useState(true);
  const [hoveredStreetIndex, setHoveredStreetIndex] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const previousIncludedStateRef = useRef({});
  const previousHoverIndexRef = useRef(null);

  // Get difficulty from stored value (calculated when street set was created)
  const getStreetDifficulty = (street) => {
    return street.difficulty || 2; // Default to medium if not set
  };

  const getDifficultyLabel = (difficulty) => {
    switch (difficulty) {
      case 1: return 'Easy';
      case 2: return 'Medium';
      case 3: return 'Hard';
      default: return 'Medium';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 1: return '#10b981'; // green
      case 2: return '#f59e0b'; // orange
      case 3: return '#ef4444'; // red
      default: return '#f59e0b';
    }
  };

  // Sort streets by difficulty then alphabetically
  const getSortedStreets = () => {
    if (!streetSet) return [];
    return [...streetSet.streets].sort((a, b) => {
      const diffA = getStreetDifficulty(a);
      const diffB = getStreetDifficulty(b);
      if (diffA !== diffB) {
        return diffA - diffB; // Easy first
      }
      return a.name.localeCompare(b.name); // Then alphabetical
    });
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchStreetSet();
  }, [id, isAuthenticated, navigate]);

  const fetchStreetSet = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch street set');
      }

      const data = await response.json();
      setStreetSet(data);
      
      // Check if all streets are included
      const allIncluded = data.streets.every(s => s.included);
      setSelectAll(allIncluded);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize map when street set loads
  useEffect(() => {
    if (!streetSet || !mapRef.current || mapInstanceRef.current) return;

    console.log('Initializing map for street set');
    
    const map = window.L.map(mapRef.current, {
      center: [streetSet.center.lat, streetSet.center.lng],
      zoom: 13,
      zoomControl: true,
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Draw all streets
    drawStreets();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [streetSet]);

  const drawStreets = () => {
    if (!mapInstanceRef.current || !streetSet) return;

    // Clear existing polylines
    Object.values(polylinesRef.current).forEach((polylineArray) => {
      if (Array.isArray(polylineArray)) {
        polylineArray.forEach((polyline) => {
          if (polyline && polyline.remove) {
            polyline.remove();
          }
        });
      }
    });
    polylinesRef.current = {};
    previousIncludedStateRef.current = {};

    const map = mapInstanceRef.current;

    streetSet.streets.forEach((street, streetIndex) => {
      if (!street.coordinates || street.coordinates.length === 0) return;

      const isIncluded = street.included;
      // Initialize the tracking ref
      previousIncludedStateRef.current[streetIndex] = isIncluded;

      street.coordinates.forEach((polylineCoords) => {
        // Convert from [[lat, lng], ...] to Leaflet format
        const leafletCoords = polylineCoords.map(coord => {
          if (Array.isArray(coord)) {
            return [coord[0], coord[1]];
          }
          return [coord.lat, coord.lng];
        });

        const polyline = window.L.polyline(leafletCoords, {
          color: isIncluded ? '#10b981' : '#9ca3af',
          weight: 3,
          opacity: isIncluded ? 0.8 : 0.5,
        }).addTo(map);

        polyline.streetIndex = streetIndex;

        // Add tooltip with street name
        polyline.bindTooltip(street.name, {
          sticky: true,
          className: 'street-tooltip'
        });

        // Add click handler to toggle street inclusion
        polyline.on('click', () => {
          handleToggleStreet(streetIndex);
        });

        // Add hover handlers for polyline
        polyline.on('mouseover', () => {
          setHoveredStreetIndex(streetIndex);
        });

        polyline.on('mouseout', () => {
          setHoveredStreetIndex(null);
        });

        // Store polyline references
        if (!polylinesRef.current[streetIndex]) {
          polylinesRef.current[streetIndex] = [];
        }
        polylinesRef.current[streetIndex].push(polyline);
      });
    });

    console.log('Drew streets on map');
  };

  // Update street colors based on included status and hover state
  useEffect(() => {
    if (!mapInstanceRef.current || !streetSet) return;

    // Reset previously hovered street to its base color
    if (previousHoverIndexRef.current !== null && previousHoverIndexRef.current !== hoveredStreetIndex) {
      const prevPolylines = polylinesRef.current[previousHoverIndexRef.current];
      const prevStreet = streetSet.streets[previousHoverIndexRef.current];
      if (prevPolylines && prevStreet) {
        const isIncluded = prevStreet.included;
        prevPolylines.forEach(polyline => {
          polyline.setStyle({
            color: isIncluded ? '#10b981' : '#9ca3af',
            weight: 3,
            opacity: isIncluded ? 0.8 : 0.5,
          });
        });
      }
    }

    // Update streets whose included status has changed
    Object.keys(polylinesRef.current).forEach((index) => {
      const indexNum = parseInt(index);
      // Skip if this is the currently hovered street (will be handled below)
      if (indexNum === hoveredStreetIndex) return;

      const polylines = polylinesRef.current[index];
      const street = streetSet.streets[index];
      if (!polylines || !street) return;

      const isIncluded = street.included;
      const previousIncluded = previousIncludedStateRef.current[index];

      // Only update if included status changed or it's the first render
      if (previousIncluded === undefined || previousIncluded !== isIncluded) {
        polylines.forEach(polyline => {
          polyline.setStyle({
            color: isIncluded ? '#10b981' : '#9ca3af',
            weight: 3,
            opacity: isIncluded ? 0.8 : 0.5,
          });
        });
        previousIncludedStateRef.current[index] = isIncluded;
      }
    });

    // Highlight currently hovered street
    if (hoveredStreetIndex !== null && polylinesRef.current[hoveredStreetIndex]) {
      const polylines = polylinesRef.current[hoveredStreetIndex];
      polylines.forEach(polyline => {
        polyline.setStyle({
          color: '#f59e0b',
          weight: 5,
          opacity: 1,
        });
      });
    }

    // Update previous hover index
    previousHoverIndexRef.current = hoveredStreetIndex;
  }, [hoveredStreetIndex, streetSet]);

  const handleToggleStreet = (index) => {
    // Save current map view before updating state
    let currentView = null;
    if (mapInstanceRef.current) {
      currentView = {
        center: mapInstanceRef.current.getCenter(),
        zoom: mapInstanceRef.current.getZoom()
      };
    }

    const updatedStreets = [...streetSet.streets];
    updatedStreets[index].included = !updatedStreets[index].included;
    setStreetSet({ ...streetSet, streets: updatedStreets });
    
    // Update select all checkbox
    const allIncluded = updatedStreets.every(s => s.included);
    setSelectAll(allIncluded);

    // Restore map view after state update
    if (currentView && mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(currentView.center, currentView.zoom, { animate: false });
        }
      }, 0);
    }
  };

  const handleSelectAll = () => {
    // Save current map view before updating state
    let currentView = null;
    if (mapInstanceRef.current) {
      currentView = {
        center: mapInstanceRef.current.getCenter(),
        zoom: mapInstanceRef.current.getZoom()
      };
    }

    const newValue = !selectAll;
    const updatedStreets = streetSet.streets.map(s => ({ ...s, included: newValue }));
    setStreetSet({ ...streetSet, streets: updatedStreets });
    setSelectAll(newValue);

    // Restore map view after state update
    if (currentView && mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(currentView.center, currentView.zoom, { animate: false });
        }
      }, 0);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/street-sets/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: streetSet.name,
          description: streetSet.description,
          streets: streetSet.streets,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      alert('Changes saved successfully!');
    } catch (err) {
      alert('Error saving changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePlay = () => {
    if (!streetSet) return;

    navigate('/', {
      state: {
        streetSet: {
          name: streetSet.name,
          center: streetSet.center,
          radius: streetSet.radius,
          streets: streetSet.streets.filter(s => s.included).map(s => ({
            name: s.name,
            // Convert coordinates array format to points format
            points: s.coordinates.map(polyline =>
              polyline.map(coord => {
                if (Array.isArray(coord)) {
                  return { lat: coord[0], lng: coord[1] };
                }
                return coord;
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
  };

  if (loading) {
    return (
      <div className="street-set-detail-page">
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <AppHeader onSignIn={() => setShowAuthModal(true)} />
        <div className="detail-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="street-set-detail-page">
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <AppHeader onSignIn={() => setShowAuthModal(true)} />
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!streetSet) {
    return null;
  }

  const includedCount = streetSet.streets.filter(s => s.included).length;

  return (
    <div className="street-set-detail-page">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      
      <div className="detail-header">
        <button onClick={() => navigate('/street-sets')} className="btn-back">
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="header-content">
          <h1>{streetSet.name}</h1>
          {streetSet.description && <p className="subtitle">{streetSet.description}</p>}
          <p className="street-count">
            {includedCount} of {streetSet.streets.length} streets selected
          </p>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleSave} 
            className="btn-save"
            disabled={saving}
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button 
            onClick={handlePlay} 
            className="btn-play-set"
          >
            <Play size={20} />
            Play This Set
          </button>
        </div>
      </div>

      <div className="detail-container">
        <div>
          <div className="content-split">
          <div className="left-panel">
            <div className="select-all-section">
              <button 
                onClick={handleSelectAll} 
                className="select-all-button"
              >
                {selectAll ? <CheckSquare size={24} /> : <Square size={24} />}
                <span>{selectAll ? 'Deselect All' : 'Select All'}</span>
              </button>
            </div>

            <div className="streets-list">
              {getSortedStreets().map((street) => {
                const originalIndex = streetSet.streets.findIndex(s => s.name === street.name && s.osmId === street.osmId);
                const difficulty = getStreetDifficulty(street);
                return (
                <div 
                  key={originalIndex} 
                  className={`street-item ${street.included ? 'included' : 'excluded'}`}
                  onClick={() => handleToggleStreet(originalIndex)}
                  onMouseEnter={() => setHoveredStreetIndex(originalIndex)}
                  onMouseLeave={() => setHoveredStreetIndex(null)}
                >
                  <div className="checkbox">
                    {street.included ? <CheckSquare size={20} /> : <Square size={20} />}
                  </div>
                  <div className="street-info">
                    <span className="street-name">{street.name}</span>
                    {street.alternativeName && (
                      <span className="alt-name">({street.alternativeName})</span>
                    )}
                  </div>
                  <div className="difficulty-badge" style={{ color: getDifficultyColor(difficulty) }}>
                    <Star size={16} fill={getDifficultyColor(difficulty)} />
                    <span>{getDifficultyLabel(difficulty)}</span>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="right-panel">
            <div 
              ref={mapRef} 
              className="detail-map"
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
