// Why a street load failed, and what to tell the player (KAN-63). useStreets tags each failure
// with a kind; the game turns the kind into a title, a message and one action.

export class StreetLoadError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'StreetLoadError';
    this.kind = kind;
  }
}

/** fetch() itself failed: offline, DNS, the server down behind the tunnel */
export const networkError = () =>
  new StreetLoadError('offline', 'Check your connection, then try again.');

/** A non-2xx response from /api/streets. 400 and 503 keep the server message. */
export function responseError(status, body = {}) {
  const message = body.message;
  // The limiter's own message repeats the title, so say what to do instead
  if (status === 429)
    return new StreetLoadError(
      'rate-limit',
      'Your connection has sent a lot of requests in the last 15 minutes. Wait a few minutes, then try again.'
    );
  if (status === 503)
    return new StreetLoadError('unavailable', message || 'Try again in a few minutes.');
  if (status >= 500) return new StreetLoadError('server', 'Try again in a moment.');
  return new StreetLoadError('invalid', message || `Could not load streets (HTTP ${status}).`);
}

/**
 * An empty list. hasData false: no street data in the circle at all, i.e. outside the imported
 * extract. Otherwise there are streets, just none at this level.
 */
export function emptyError(hasData) {
  return hasData === false
    ? new StreetLoadError(
        'outside',
        'BetterBearings covers New Mexico for now. Move the circle to an area in New Mexico.'
      )
    : new StreetLoadError('empty', 'Try a harder level, or zoom out to make the circle bigger.');
}

const TITLES = {
  offline: "Can't reach BetterBearings",
  'rate-limit': 'Too many requests',
  unavailable: "Street data isn't ready",
  server: 'Something went wrong on our side',
  invalid: "Couldn't use that area",
  outside: 'No street data here',
  empty: 'No streets for this level here',
};

// Failures that may clear on their own get Retry; the rest need a different area
const RETRY = new Set(['offline', 'rate-limit', 'unavailable', 'server']);

/**
 * @param {{ kind?: string, message?: string }} error
 * @returns {{ kind: string, title: string, message: string, action: 'retry' | 'new-area' }}
 */
export function describeStreetError({ kind, message } = {}) {
  const known = kind in TITLES ? kind : 'server';
  return {
    kind: known,
    title: TITLES[known],
    message: message || 'Try again in a moment.',
    action: RETRY.has(known) ? 'retry' : 'new-area',
  };
}
