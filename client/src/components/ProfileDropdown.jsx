import { useState, useRef, useEffect, useId } from 'react';
import { User, Play, Layers, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ProfileDropdown.css';

export default function ProfileDropdown({ onDeleteAccount }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Close on a tap or click outside, and on Escape (KAN-61). pointerdown, not mousedown:
  // iOS Safari sends no mousedown for a tap on a non-clickable area such as the map.
  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
        ref={buttonRef}
        type="button"
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <div className="profile-avatar">
          <User size={20} aria-hidden="true" />
        </div>
      </button>

      {isOpen && (
        <div className="dropdown-menu" id={menuId}>
          <div className="dropdown-header">
            <div className="profile-user-info">
              <div className="user-name">{user?.username || 'User'}</div>
              <div className="user-email">{user?.email || ''}</div>
            </div>
          </div>

          <div className="dropdown-divider" />

          <button className="dropdown-item" onClick={() => handleNavigation('/')}>
            <Play size={18} aria-hidden="true" />
            <span>Play</span>
          </button>

          <button className="dropdown-item" onClick={() => handleNavigation('/street-sets')}>
            <Layers size={18} aria-hidden="true" />
            <span>Street Sets</span>
          </button>

          <div className="dropdown-divider" />

          <button className="dropdown-item logout" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" />
            <span>Sign Out</span>
          </button>

          <button
            className="dropdown-item delete-account"
            onClick={() => {
              setIsOpen(false);
              // The dialog returns focus to its opener; this item is about to unmount
              buttonRef.current?.focus();
              onDeleteAccount();
            }}
          >
            <Trash2 size={18} aria-hidden="true" />
            <span>Delete account</span>
          </button>
        </div>
      )}
    </div>
  );
}
