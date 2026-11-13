// Sends email through Resend's HTTP API (KAN-69). No SDK: one POST with fetch.
// Without RESEND_API_KEY (dev and tests) nothing is sent and the message is logged instead;
// createApp refuses to start in production without a key, so that never happens there.
const logger = require('./logger');

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'BetterBearings <noreply@betterbearings.net>';
const DEFAULT_REPLY_TO = 'contact@betterbearings.net';

async function send({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.info({ to, subject, text }, 'Email not sent: RESEND_API_KEY is unset');
    return { skipped: true };
  }
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      reply_to: process.env.EMAIL_REPLY_TO || DEFAULT_REPLY_TO,
      to: [to],
      subject,
      text,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Resend returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

// Routes call mailer.send, so tests can swap in a fake
const mailer = { send };

module.exports = { mailer };
