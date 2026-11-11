import { Target, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileDropdown from './ProfileDropdown';
import './AppHeader.css';

export default function AppHeader({ onSignIn }) {
  const { isAuthenticated } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <h1 className="app-title">
          <Link to="/" className="app-title-link">
            <Target className="app-icon" aria-hidden="true" />
            BetterBearings
          </Link>
        </h1>
      </div>

      <div className="app-header-actions">
        {isAuthenticated ? (
          <ProfileDropdown />
        ) : (
          <button onClick={onSignIn} className="app-header-sign-in">
            <User size={18} />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
