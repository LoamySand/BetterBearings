import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../config';
import LegalPage from './LegalPage';

// KAN-67. Every statement here matches the code or the deploy scripts; change both together.
// Log fields: pino-http in server/app.js. Backups: deploy/bin/backup.sh (14 days) and
// offsite.sh (56 days). Log size: the ProDesk's /etc/docker/daemon.json (local, 10m x 3).
export default function Privacy() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        BetterBearings is a free game for learning street names. One person, Lane Boyd, runs it as a
        hobby project. This page says what the site stores about you, why, and how to delete it.
      </p>

      <h2>What&apos;s stored</h2>
      <p>
        If you play without an account, nothing about you is stored apart from the request logs
        described below. If you create an account, the site stores:
      </p>
      <ul>
        <li>your username and email address</li>
        <li>a bcrypt hash of your password, never the password itself</li>
        <li>the date you signed up</li>
        <li>your street sets: their names, map areas and streets</li>
        <li>
          if you ask for a password reset: when you asked, and a one-way hash of the link (the link
          itself is only in the email)
        </li>
      </ul>
      <p>
        Your browser keeps one item for the site: a login token in local storage. It lasts 7 days,
        and signing out removes it. The site sets no cookies and runs no analytics, ads or tracking.
      </p>

      <h2>Request logs</h2>
      <p>
        Each request to the server is logged with your IP address, the time, the address requested,
        the response status and the headers your browser sent, including its user agent. Passwords
        and login tokens are removed before anything is written. The logs are used to fix problems
        and to stop abuse, such as repeated login attempts.
      </p>
      <p>
        The server keeps at most 30 MB of logs and overwrites the oldest first. All logs are deleted
        whenever the app is updated.
      </p>

      <h2>How your email is used</h2>
      <p>
        Your email address is how you log in, and where password reset links go when you ask for
        one. Those are the only emails the site sends; your address is never used for marketing.
        Nothing about you is sold, rented or shared, except with the services below that keep the
        site running.
      </p>

      <h2>Services that handle your data</h2>
      <ul>
        <li>
          <strong>Cloudflare</strong> sits in front of the site, so it sees your IP address and
          requests. See{' '}
          <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare&apos;s privacy policy</a>.
        </li>
        <li>
          <strong>Google Drive</strong> stores the weekly offsite backups. They are encrypted before
          they leave the server, so Google can&apos;t read them.
        </li>
        <li>
          <strong>Resend</strong> sends password reset emails, so it receives your email address and
          the email itself when you ask for a reset, and keeps a copy for 30 days. A reset link
          stops working after 30 minutes. See{' '}
          <a href="https://resend.com/legal/privacy-policy">Resend&apos;s privacy policy</a>.
        </li>
      </ul>
      <p>
        The app, the database, the maps and the street data all run on a server in the United States
        that I own. Map views aren&apos;t sent to any outside map service.
      </p>

      <h2>Backups</h2>
      <p>
        The database is backed up every night, and each nightly backup is kept for 14 days. Once a
        week the newest backup is encrypted and copied offsite, where it is kept for 8 weeks.
      </p>

      <h2>Deleting your account</h2>
      <p>
        Open the profile menu, choose <strong>Delete account</strong> and enter your password. Your
        account and all your street sets are deleted at once. Copies in backups expire on the
        schedule above, so all of your data is gone within 8 weeks. If you can&apos;t log in, email{' '}
        {mail} from your account&apos;s address and I&apos;ll delete it for you.
      </p>

      <h2>Children</h2>
      <p>
        BetterBearings isn&apos;t meant for children under 13, and they shouldn&apos;t create an
        account. If you believe a child under 13 has one, email {mail} and it will be deleted.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date at the top changes with it. The{' '}
        <Link to="/terms">Terms of Use</Link> cover the rules for using the site.
      </p>

      <h2>Contact</h2>
      <p>Questions about your data: {mail}</p>
    </LegalPage>
  );
}
