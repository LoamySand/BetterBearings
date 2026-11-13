import { User } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileDropdown from './ProfileDropdown';
import DeleteAccountModal from './DeleteAccountModal';
// Vite inlines it (under 4 KB) into the hashed bundle, cached for a year, so the header makes no
// request for it. public/favicon.svg stays for the browser tab and the manifest (L2).
import appIcon from '../assets/app-icon.svg';
import './AppHeader.css';

export default function AppHeader({ onSignIn }) {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  // Lives here, not in ProfileDropdown: a successful delete logs out, which unmounts the dropdown.
  // Portaled to body: the header's backdrop-filter would otherwise clip a fixed overlay to the header.
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-brand">
        <h1 className="app-title">
          <Link to="/" className="app-title-link">
            <img src={appIcon} className="app-icon" alt="" width="32" height="32" />
            BetterBearings
          </Link>
        </h1>
      </div>

      <div className="app-header-actions">
        {isAuthenticated ? (
          <ProfileDropdown onDeleteAccount={() => setDeleteOpen(true)} />
        ) : (
          <button onClick={onSignIn} className="app-header-sign-in">
            <User size={18} />
            Sign In
          </button>
        )}
      </div>

      {deleteOpen &&
        createPortal(
          <DeleteAccountModal
            onClose={() => setDeleteOpen(false)}
            onDeleted={() => {
              setDeleteOpen(false);
              logout();
              navigate('/');
            }}
          />,
          document.body
        )}
    </header>
  );
}
