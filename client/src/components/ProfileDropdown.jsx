import { useState, useRef, useEffect } from 'react';
import { User, Play, Layers, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ProfileDropdown.css';

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button 
        className="profile-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
      >
        <div className="profile-avatar">
          <User size={20} />
        </div>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <div className="user-info">
              <div className="user-name">{user?.username || 'User'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
          </div>
          
          <div className="dropdown-divider" />
          
          <button 
            className="dropdown-item" 
            onClick={() => handleNavigation('/')}
          >
            <Play size={18} />
            <span>Play</span>
          </button>
          
          <button 
            className="dropdown-item" 
            onClick={() => handleNavigation('/street-sets')}
          >
            <Layers size={18} />
            <span>Street Sets</span>
          </button>
          
          <div className="dropdown-divider" />
          
          <button 
            className="dropdown-item logout" 
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
