import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import useDialog from '../hooks/useDialog';
import './DeleteAccountModal.css';

const MESSAGES = {
  403: 'Incorrect password.',
  429: 'Too many attempts. Try again in 15 minutes.',
};

// Confirm dialog for deleting the account (KAN-66). Owned by AppHeader, not ProfileDropdown,
// because a successful delete logs the user out and the dropdown unmounts with it.
export default function DeleteAccountModal({ onClose, onDeleted }) {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [setCount, setSetCount] = useState(null);
  const inputRef = useRef(null);

  const okRef = useRef(null);
  // No closing mid-request: a 204 has already removed the token, and only onDeleted logs out
  const finish = submitting ? undefined : deleted ? onDeleted : onClose;
  const { titleId, dialogProps } = useDialog(finish);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('authToken');
    fetch(`${API_URL}/street-sets`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((sets) => !cancelled && Array.isArray(sets) && setSetCount(sets.length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // useDialog focuses once on open; move focus when the content changes
  useEffect(() => {
    if (deleted) okRef.current?.focus();
  }, [deleted]);
  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await deleteAccount(password);
    setSubmitting(false);
    if (result.ok) {
      setDeleted(true);
    } else if (result.status === 401) {
      // The account was already gone; deleteAccount removed the token
      setDeleted(true);
    } else {
      setError(MESSAGES[result.status] || "Couldn't delete your account. Try again.");
    }
  };

  const sets =
    setCount === null
      ? ' and all your street sets'
      : setCount === 0
        ? ''
        : setCount === 1
          ? ' and your 1 street set'
          : ` and all ${setCount} of your street sets`;

  return (
    <div className="delete-account-overlay" onClick={finish}>
      <div className="delete-account-modal" {...dialogProps} onClick={(e) => e.stopPropagation()}>
        {deleted ? (
          <>
            <h2 id={titleId} className="delete-account-title">
              Your account was deleted
            </h2>
            <p className="delete-account-text">Your street sets are gone too.</p>
            <div className="delete-account-actions">
              <button ref={okRef} type="button" className="delete-account-ok" onClick={onDeleted}>
                OK
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="delete-account-title">
              Delete account
            </h2>
            <p className="delete-account-text">
              This deletes your account{sets}. It can&apos;t be undone.
            </p>
            <form onSubmit={handleSubmit} className="delete-account-form">
              <div className="delete-account-field">
                <label htmlFor="delete-account-password">Enter your password to confirm</label>
                <input
                  ref={inputRef}
                  type="password"
                  id="delete-account-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  maxLength={72}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'delete-account-error' : undefined}
                />
              </div>
              {error && (
                <div id="delete-account-error" className="delete-account-error" role="alert">
                  {error}
                </div>
              )}
              <div className="delete-account-actions">
                <button
                  type="button"
                  className="delete-account-cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="delete-account-confirm"
                  disabled={!password || submitting}
                >
                  {submitting ? 'Deleting...' : 'Delete account'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
