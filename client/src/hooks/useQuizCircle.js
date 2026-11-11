import { useEffect } from 'react';
import { quizAreaFor, circleLabel } from '../utils/quizArea';

const OK_STYLE = {
  color: '#4f46e5',
  weight: 2,
  dashArray: '6 6',
  fillColor: '#4f46e5',
  fillOpacity: 0.08,
};
// Room above the label's anchor for the label itself
const LABEL_ROOM = 48;
const TOO_SMALL_STYLE = {
  color: '#dc2626',
  weight: 2,
  dashArray: '6 6',
  fillColor: '#dc2626',
  fillOpacity: 0.08,
};

/**
 * Draws the Current Location quiz area on the selection map and keeps it on the map center
 * as the player pans and zooms (KAN-76). Same numbers as the Play button: utils/quizArea.js.
 * The label on the top edge shows the radius, or asks to zoom out under 500 m.
 */
export function useQuizCircle({ map, active }) {
  useEffect(() => {
    // Leaflet deletes _mapPane in map.remove(); a removed map can't take layers or give bounds
    if (!active || !map || !map._mapPane || !window.L) return undefined;
    const L = window.L;

    const area = quizAreaFor(map);
    const circle = L.circle([area.center.lat, area.center.lng], {
      radius: area.radius,
      // Not clickable, so drags and taps reach the map
      interactive: false,
      ...(area.tooSmall ? TOO_SMALL_STYLE : OK_STYLE),
    }).addTo(map);

    const label = L.tooltip({
      permanent: true,
      direction: 'top',
      offset: [0, -4],
      className: 'quiz-circle-label',
    });
    label.setContent(circleLabel(area));

    const update = () => {
      const next = quizAreaFor(map);
      circle.setLatLng([next.center.lat, next.center.lng]);
      circle.setRadius(next.radius);
      circle.setStyle(next.tooSmall ? TOO_SMALL_STYLE : OK_STYLE);
      label.setContent(circleLabel(next));
      label.getElement()?.classList.toggle('quiz-circle-label--small', next.tooSmall);
      // Label on the circle's top edge. When the map is wider than tall, that edge sits close
      // to the top of the map, so keep the label at least LABEL_ROOM px below it.
      const center = map.latLngToContainerPoint([next.center.lat, next.center.lng]);
      const edgeLat = L.latLng(next.center.lat, next.center.lng)
        .toBounds(next.radius * 2)
        .getNorth();
      const edge = map.latLngToContainerPoint([edgeLat, next.center.lng]);
      label.setLatLng(map.containerPointToLatLng([center.x, Math.max(edge.y, LABEL_ROOM)]));
    };

    // A tooltip needs a position before it's added; the second update styles its element
    update();
    label.addTo(map);
    update();
    map.on('move zoom resize', update);

    return () => {
      map.off('move zoom resize', update);
      // map.remove() may have run already (starting a game removes the selection map);
      // removing a layer from a removed map is a no-op
      circle.remove();
      label.remove();
    };
  }, [map, active]);
}
