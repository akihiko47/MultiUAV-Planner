import { useState } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';

export default function MouseCoordinates() {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });

  useMapEvents({
    mousemove: (e) => {
      const { lat, lng } = e.latlng;
      setCoords({ lat, lng });
    },
  });

  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      zIndex: 1000,
      background: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontFamily: 'monospace'
    }}>
      Lat: {coords.lat.toFixed(6)}, Lng: {coords.lng.toFixed(6)}
    </div>
  );
}