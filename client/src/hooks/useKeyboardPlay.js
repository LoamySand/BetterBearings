import { useEffect, useRef, useState } from 'react';

// Keyboard play (KAN-64): Space / Shift+Space moves a highlight between streets, nearest to the
// map center first; Enter guesses the highlighted street; S skips. The highlight never shows
// the street's name, since that's the answer.
//
// Keys are ignored while focus is on a control (Space and Enter must still press buttons) or a
// dialog is open. Leaflet's own keys keep working on the focused map: arrows pan, + and - zoom.

const CONTROLS = 'button, a[href], input, select, textarea, [contenteditable="true"]';

function streetOrder(map, polylines) {
  const center = map.getCenter();
  return Object.entries(polylines)
    .filter(([, segments]) => segments.length > 0)
    .map(([name, segments]) => {
      const nearest = Math.min(
        ...segments.map((seg) => map.distance(center, seg.getBounds().getCenter()))
      );
      return {
        name,
        nearest,
        // A fresh bounds object: extend() changes it in place, and getBounds() is the polyline's own
        bounds: segments.reduce((b, s) => b.extend(s.getBounds()), window.L.latLngBounds([])),
      };
    })
    .sort((a, b) => a.nearest - b.nearest);
}

export function useKeyboardPlay({
  active,
  round,
  mapInstanceRef,
  polylinesRef,
  setHighlight,
  guess,
  skip,
}) {
  // Tagged with its round, so a new round shows no stale announcement
  const [status, setStatus] = useState({ round, text: '' });
  const orderRef = useRef(null);
  const indexRef = useRef(-1);

  // A new round starts with no highlight
  useEffect(() => {
    orderRef.current = null;
    indexRef.current = -1;
    setHighlight(null);
  }, [round, setHighlight]);

  useEffect(() => {
    if (!active) return undefined;

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest(CONTROLS)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (event.key === ' ') {
        event.preventDefault();
        if (!orderRef.current) orderRef.current = streetOrder(map, polylinesRef.current);
        const order = orderRef.current;
        if (!order.length) return;
        const step = event.shiftKey ? -1 : 1;
        indexRef.current = (indexRef.current + step + order.length) % order.length;
        const street = order[indexRef.current];
        setHighlight(street.name);
        if (!map.getBounds().intersects(street.bounds)) map.panTo(street.bounds.getCenter());
        setStatus({
          round,
          text: `Street ${indexRef.current + 1} of ${order.length} highlighted. Enter to guess.`,
        });
      } else if (event.key === 'Enter') {
        const street = orderRef.current?.[indexRef.current];
        if (!street) return;
        event.preventDefault();
        guess(street.name);
      } else if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        skip();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, round, mapInstanceRef, polylinesRef, setHighlight, guess, skip]);

  return status.round === round ? status.text : '';
}
