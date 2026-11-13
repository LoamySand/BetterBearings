import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, SOURCE_URL } from '../config';
import LegalPage from './LegalPage';

// KAN-67
export default function Terms() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Terms of Use">
      <p>
        By using BetterBearings you agree to these terms. If you don&apos;t agree, please don&apos;t
        use the site. The <Link to="/privacy">Privacy Policy</Link> explains what data the site
        keeps.
      </p>

      <h2>A hobby project</h2>
      <p>
        BetterBearings is free and non-commercial, and one person runs it in their spare time. It is
        provided as is, without any warranty. There&apos;s no promise of uptime: the site may be
        slow or offline, data may be lost, and features may change or end. To the extent the law
        allows, I&apos;m not liable for any loss that comes from using it.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 13 or older to create an account.</li>
        <li>Use an email address you can receive mail at.</li>
        <li>Keep your password to yourself. You&apos;re responsible for what your account does.</li>
        <li>You can delete your account at any time from the profile menu.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Please don&apos;t:</p>
      <ul>
        <li>pick a username or street set name that is offensive or impersonates someone</li>
        <li>scrape the site, flood it with requests or work around its rate limits</li>
        <li>try to get into other people&apos;s accounts or data</li>
      </ul>
      <p>
        Accounts that break these rules may be removed. If you find a security problem, please email{' '}
        {mail} instead of testing it on the live site.
      </p>

      <h2>Map data</h2>
      <p>
        Street data &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available
        under the Open Database License (ODbL). Map style by{' '}
        <a href="https://protomaps.com">Protomaps</a>, drawn with{' '}
        <a href="https://leafletjs.com">Leaflet</a>. Map data can be wrong or out of date, so
        don&apos;t use BetterBearings to navigate.
      </p>

      <h2>Source code</h2>
      <p>
        The code is open source under the MIT License, on <a href={SOURCE_URL}>GitHub</a>.
      </p>

      <h2>Changes</h2>
      <p>If these terms change, the date at the top changes with them.</p>

      <h2>Contact</h2>
      <p>{mail}</p>
    </LegalPage>
  );
}
