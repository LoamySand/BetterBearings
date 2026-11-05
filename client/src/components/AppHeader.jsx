import { Target, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileDropdown from './ProfileDropdown';
import './AppHeader.css';

export default function AppHeader({ onSignIn }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-header">
      <div className="header-content">
        <h1 className="app-title" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <Target className="app-icon" />
          BetterBearings
        </h1>
      </div>

      <div className="header-actions">
        {isAuthenticated ? (
          <ProfileDropdown />
        ) : (
          <button onClick={onSignIn} className="btn-login">
            <User size={18} />
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
