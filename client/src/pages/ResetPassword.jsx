import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, CircleCheck, TriangleAlert } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import StatusPanel from '../components/StatusPanel';
import { useAuth } from '../contexts/AuthContext';
import './ResetPassword.css';

// The token travels in the fragment (#token=...), which browsers never send to the server.
// It's read at load, then taken out of the address bar so it doesn't stay in history (KAN-69).
const tokenFromUrl = () => window.location.hash.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? null;

export default function ResetPassword() {
  const [token] = useState(tokenFromUrl);
  // In an effect, not the initializer: React may run an initializer twice in development
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // form, done or invalid
  const [state, setState] = useState(token ? 'form' : 'invalid');
  const [authMode, setAuthMode] = useState(null); // opens AuthModal in 'login' or 'forgot'
  const { resetPassword, logout } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await resetPassword(token, password);
    setSubmitting(false);
    if (result.ok) {
      // Every login from before the reset has stopped working, this browser's too
      logout();
      setState('done');
    } else if (result.status === 400 && /invalid or has expired/.test(result.message ?? '')) {
      setState('invalid');
    } else if (result.status === 400) {
      setError(result.message || 'Choose a different password.');
    } else if (result.status === 429) {
      setError('Too many attempts. Try again in 15 minutes.');
    } else {
      setError("Couldn't change your password. Try again.");
    }
  };

  return (
    <div className="status-layout">
      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
      <AppHeader onSignIn={() => setAuthMode('login')} />
      <main className="status-page">
        {state === 'done' && (
          <StatusPanel
            icon={CircleCheck}
            title="Password changed"
            actions={
              <button
                type="button"
                className="status-panel-action"
                onClick={() => setAuthMode('login')}
              >
                Log in
              </button>
            }
          >
            <p>Log in with your new password. Any other devices have been signed out.</p>
          </StatusPanel>
        )}

        {state === 'invalid' && (
          <StatusPanel
            variant="error"
            icon={TriangleAlert}
            title="This reset link doesn't work"
            actions={
              <>
                <button
                  type="button"
                  className="status-panel-action"
                  onClick={() => setAuthMode('forgot')}
                >
                  Send a new link
                </button>
                <Link to="/" className="status-panel-action status-panel-action--secondary">
                  Play a game
                </Link>
              </>
            }
          >
            <p>Links work once, for 30 minutes. Ask for a new one and use the latest email.</p>
          </StatusPanel>
        )}

        {state === 'form' && (
          <section className="reset-card" aria-labelledby="reset-title">
            <div className="reset-icon">
              <KeyRound size={40} aria-hidden="true" />
            </div>
            <h1 id="reset-title" className="reset-title">
              Choose a new password
            </h1>
            <form onSubmit={handleSubmit} className="reset-form">
              <div className="reset-field">
                <label htmlFor="reset-password">New password</label>
                <input
                  type="password"
                  id="reset-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  required
                  minLength={12}
                  maxLength={72}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  enterKeyHint="next"
                />
              </div>
              <div className="reset-field">
                <label htmlFor="reset-confirm">Type it again</label>
                <input
                  type="password"
                  id="reset-confirm"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setError('');
                  }}
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  enterKeyHint="done"
                />
              </div>
              {error && (
                <div className="reset-error" role="alert">
                  {error}
                </div>
              )}
              <button type="submit" className="reset-submit" disabled={submitting}>
                {submitting ? 'Please wait...' : 'Change password'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
