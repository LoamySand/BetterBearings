import { Link } from 'react-router-dom';
import { SOURCE_URL } from '../config';
import GithubIcon from './GithubIcon';
import './SiteFooter.css';

// Privacy, Terms and source links (KAN-67). On pages that scroll; the game screen and the
// set detail page fill the screen and have no room for it.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav" aria-label="Site">
        <Link to="/privacy" className="site-footer-link">
          Privacy
        </Link>
        <Link to="/terms" className="site-footer-link">
          Terms
        </Link>
        <a
          href={SOURCE_URL}
          className="site-footer-link site-footer-github"
          aria-label="Source code on GitHub"
        >
          <GithubIcon size={20} />
        </a>
      </nav>
    </footer>
  );
}
