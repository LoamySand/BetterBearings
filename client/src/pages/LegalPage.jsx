import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import AuthModal from '../components/AuthModal';
import SiteFooter from '../components/SiteFooter';
import './LegalPage.css';

// Shared layout for /privacy and /terms (KAN-67)
export const LEGAL_UPDATED = { iso: '2026-11-13', text: 'November 13, 2026' };

export default function LegalPage({ title, children }) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    document.title = `${title} | BetterBearings`;
    window.scrollTo(0, 0);
    return () => {
      document.title = 'BetterBearings';
    };
  }, [title]);

  return (
    <div className="legal-page">
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <AppHeader onSignIn={() => setShowAuthModal(true)} />
      <main className="legal-main">
        <article className="legal-article readable">
          <h1 className="legal-title">{title}</h1>
          <p className="legal-updated">
            Last updated <time dateTime={LEGAL_UPDATED.iso}>{LEGAL_UPDATED.text}</time>
          </p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
