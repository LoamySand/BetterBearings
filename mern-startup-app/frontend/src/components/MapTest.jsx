import { useEffect, useRef } from 'react';

export default function MapTest() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || mapInstanceRef.current) return;

    // Dynamically import Leaflet
    import('leaflet')
      .then((L) => {
        const leaflet = L.default;

        // Fix icon issue
        delete leaflet.Icon.Default.prototype._getIconUrl;
        leaflet.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Create map
        if (mapRef.current && !mapInstanceRef.current) {
          const map = leaflet.map(mapRef.current).setView([35.0844, -106.6504], 12);

          leaflet
            .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
            })
            .addTo(map);

          // Add a test marker
          leaflet.marker([35.0844, -106.6504]).addTo(map).bindPopup('Albuquerque, NM').openPopup();

          mapInstanceRef.current = map;
          console.log('Map created successfully!');
        }
      })
      .catch((err) => {
        console.error('Error loading Leaflet:', err);
      });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Map Test</h1>
      <div
        ref={mapRef}
        style={{
          height: '500px',
          width: '100%',
          border: '2px solid red',
          background: '#f0f0f0',
        }}
      />
    </div>
  );
}
