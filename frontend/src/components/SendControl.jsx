import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import { buildPayload } from '../utils/buildPayload';

const API_URL = 'http://localhost:8000/api/v1/plan';

export default function SendControl({
  label = 'Отправить на сервер',
  position = 'topright',
  selectedUavs = [],
  surveyType = 'RGB',
  optimization = 'min_time',
}) {
  const map = useMap();

  useEffect(() => {
    const handleSend = async () => {
      const payload = buildPayload(map, {
        selectedUavs,
        surveyType,
        optimization,
      });

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return res.json();
    };

    const control = L.control({ position });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      const btn = L.DomUtil.create('button', '', div);
      btn.textContent = label;
      btn.className = 'save-marks-btn';

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(btn, 'click', async () => {
        btn.disabled = true;
        btn.textContent = 'Отправка...';
        try {
          const data = await handleSend();
          console.log('Ответ сервера:', data);
          btn.textContent = 'Отправлено ✓';
        } catch (e) {
          console.error(e);
          btn.textContent = 'Ошибка';
        }
        setTimeout(() => {
          btn.textContent = label;
          btn.disabled = false;
        }, 2000);
      });

      return div;
    };

    control.addTo(map);
    return () => control.remove();
  }, [map, label, position, selectedUavs, surveyType, optimization]);

  return null;
}