import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

export default function SaveControl({ label = 'Сохранить', position = 'topright' }) {
  const map = useMap();

  useEffect(() => {
    const handleSave = () => {
      const features = [];
      map.eachLayer((layer) => {
        
        if (layer.options?.noSave) return;

        if (layer instanceof L.Polygon) features.push(layer.toGeoJSON());
        else if (layer instanceof L.Marker) {
          const ll = layer.getLatLng();
          features.push({ type: 'marker', lat: ll.lat, lng: ll.lng });
        }
      });

      const blob = new Blob([JSON.stringify(features, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `map-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const control = L.control({ position });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      const btn = L.DomUtil.create('button', '', div);
      btn.textContent = label;
      btn.style.cssText =
        'padding:6px 10px; cursor:pointer; background:#fff; border:none; font:inherit;';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(btn, 'click', handleSave);
      return div;
    };

    control.addTo(map);
    return () => control.remove();
  }, [map, label, position]);

  return null;
}