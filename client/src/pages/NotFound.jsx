import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import StatusPanel from '../components/StatusPanel';

// Any client route App doesn't know (KAN-63). The server's SPA fallback sends index.html for
// every path, so this is where a bad URL ends up.
export default function NotFound() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  return (
    <div className="status-layout">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      <main className="status-page">
        <StatusPanel
          icon={Compass}
          title="Page not found"
          actions={
            <Link to="/" className="status-panel-action">
              Play a game
            </Link>
          }
        >
          <p>Nothing lives at this address. Check the link, or start a game from the map.</p>
        </StatusPanel>
      </main>
    </div>
  );
}
