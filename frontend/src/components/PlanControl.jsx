import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { collectMapData, buildPlan, downloadPlan, sendPlan } from '../utils/plan';

export default function PlanControl({
  position = 'topright',
  selectedUavs = [],
  uavCounts = {},
  surveyType = 'RGB',
  optimization = 'min_time',
  startDate = '',
}) {
  const map = useMap();

  useEffect(() => {
    const makePayload = () => {
      const mapData = collectMapData(map);
      return buildPlan({
        mapData,
        selectedUavs,
        uavCounts,
        surveyType,
        optimization,
        startDate,
      });
    };

    const handleSave = () => {
      try {
        const plan = makePayload();
        downloadPlan(plan);
        console.log('💾 Сохранено:', plan);
      } catch (err) {
        console.error(err);
        alert('Ошибка сохранения: ' + err.message);
      }
    };

    const handleSend = async () => {
      try {
        const plan = makePayload();
        console.log('📤 Отправляем:', plan);
        const result = await sendPlan(plan);
        console.log('✅ Ответ сервера:', result);
        alert('План отправлен');
      } catch (err) {
        console.error(err);
        alert('Ошибка отправки: ' + err.message);
      }
    };

    const control = L.control({ position });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar plan-control');

      const btnSave = L.DomUtil.create('button', 'plan-btn', div);
      btnSave.textContent = 'Скачать JSON';
      btnSave.type = 'button';

      const btnSend = L.DomUtil.create('button', 'plan-btn', div);
      btnSend.textContent = 'Отправить';
      btnSend.type = 'button';

      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(btnSave, 'click', handleSave);
      L.DomEvent.on(btnSend, 'click', handleSend);

      return div;
    };

    control.addTo(map);
    return () => control.remove();
  }, [map, selectedUavs, uavCounts, surveyType, optimization, startDate, position]);

  return null;
}