import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { collectMapData, buildPlan, downloadPlan } from '../utils/plan';

export default function SaveControl({
  label = 'Скачать JSON',
  position = 'topright',
  selectedUavs = [],
  uavCounts = {},
  surveyType = 'RGB',
  optimization = 'min_time',
  startDate = '',
}) {
  const map = useMap();

  useEffect(() => {
    const handleSave = () => {
      try {
        const mapData = collectMapData(map);
        const plan = buildPlan({
          mapData,
          selectedUavs,
          uavCounts,
          surveyType,
          optimization,
          startDate,
        });

        downloadPlan(plan);
        console.log('💾 Сохранено:', plan);
      } catch (err) {
        console.error('Ошибка сохранения:', err);
        alert('Не удалось сохранить файл: ' + err.message);
      }
    };

    const control = L.control({ position });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar');
      const btn = L.DomUtil.create('button', '', div);
      btn.textContent = label;
      btn.className = 'save-marks-btn';
      btn.type = 'button';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(btn, 'click', handleSave);
      return div;
    };

    control.addTo(map);
    return () => control.remove();
  }, [map, label, position, selectedUavs, uavCounts, surveyType, optimization, startDate]);

  return null;
}