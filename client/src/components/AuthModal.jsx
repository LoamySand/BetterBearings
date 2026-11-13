import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useDialog from '../hooks/useDialog';
import './AuthModal.css';

const TITLES = { login: 'Welcome Back!', signup: 'Create Account', forgot: 'Reset your password' };
const SUBMIT = { login: 'Log In', signup: 'Sign Up', forgot: 'Send reset link' };

// mode: 'login', 'signup' or 'forgot' (KAN-69: asks for a password reset email)
export default function AuthModal({ onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const isLogin = mode === 'login';
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The forgot step's reply, shown in place of the form once sent
  const [resetSent, setResetSent] = useState('');

  const { login, signup, requestPasswordReset } = useAuth();
  const { titleId, dialogProps } = useDialog(onClose);
  // The clicked mode button unmounts, so move focus to the email field after a switch
  const emailRef = useRef(null);
  const switched = useRef(false);
  useEffect(() => {
    if (switched.current) emailRef.current?.focus();
  }, [mode]);

  const switchMode = (next) => {
    switched.current = true;
    setMode(next);
    setFormError('');
    setResetSent('');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setFormError('');
  };

  const handleForgot = async () => {
    const result = await requestPasswordReset(formData.email);
    if (result.ok) {
      setResetSent(result.message);
    } else if (result.status === 429) {
      setFormError('Too many reset requests. Try again in 15 minutes.');
    } else if (result.status === 400) {
      setFormError(result.message || 'Enter a valid email address');
    } else {
      setFormError("Couldn't send the reset email. Try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (mode === 'forgot') {
        await handleForgot();
        return;
      }
      const result = isLogin
        ? await login(formData.email, formData.password)
        : await signup(formData.username, formData.email, formData.password);

      if (result.success) {
        onClose();
      } else {
        setFormError(result.error);
      }
    } catch (err) {
      setFormError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" {...dialogProps} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 id={titleId} className="auth-modal-title">
          {TITLES[mode]}
        </h2>

        {mode === 'forgot' && resetSent ? (
          <div className="auth-form">
            <p className="auth-note" role="status">
              {resetSent}
            </p>
            <button type="button" className="auth-submit-btn" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'forgot' && (
              <p className="auth-note">
                Enter your account&apos;s email address and we&apos;ll send you a link to choose a
                new password.
              </p>
            )}

            {mode === 'signup' && (
              <div className="auth-field">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="Choose a username"
                  minLength={3}
                  maxLength={30}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                ref={emailRef}
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={mode === 'forgot' ? 'send' : 'next'}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={isLogin ? undefined : 12}
                  maxLength={72}
                  placeholder={isLogin ? 'Your password' : 'At least 12 characters'}
                  // Lets password managers fill on login and offer a strong password on signup
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  enterKeyHint="go"
                />
              </div>
            )}

            {formError && (
              <div className="auth-error" role="alert">
                {formError}
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait...' : SUBMIT[mode]}
            </button>

            {/* After the button, so it doesn't move the button down (KAN-69) */}
            {isLogin && (
              <button
                type="button"
                className="auth-forgot-btn"
                onClick={() => switchMode('forgot')}
              >
                Forgot password?
              </button>
            )}

            {/* Below the button, so the button stays above the phone keyboard (KAN-67). New tabs
              keep a half-filled form. */}
            {mode === 'signup' && (
              <p className="auth-legal">
                By signing up you agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener">
                  Terms of Use<span className="sr-only"> (opens in a new tab)</span>
                </a>{' '}
                and acknowledge the{' '}
                <a href="/privacy" target="_blank" rel="noopener">
                  Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
                </a>
                .
              </p>
            )}
          </form>
        )}

        <div className="auth-toggle">
          {mode === 'forgot' ? (
            <>
              Remembered it?{' '}
              <button type="button" className="auth-toggle-btn" onClick={() => switchMode('login')}>
                Log In
              </button>
            </>
          ) : (
            <>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => switchMode(isLogin ? 'signup' : 'login')}
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
