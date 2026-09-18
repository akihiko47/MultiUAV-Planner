import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import uavsData from '../data/uavs.json';
const API_URL = 'http://localhost:8000/api/v1/plan';

export default function SaveControl({
  label = 'Скачать JSON',
  position = 'topright',
  selectedUavs = [],
  surveyType = 'RGB',
  optimization ='min_time',
}) {
  const map = useMap();

  useEffect(() => {
    const handleSave = () => {
      const polygons = [];
      const markers = [];

      map.eachLayer((layer) => {
        if (layer.options?.noSave) return;

        if (layer instanceof L.Polygon) {
          polygons.push(layer.toGeoJSON());
        } else if (layer instanceof L.Marker) {
          const ll = layer.getLatLng();
          markers.push({ lat: ll.lat, lng: ll.lng });
        }
      });

      // 1. Зона съёмки — первый полигон
      const surveyArea = polygons[0]
        ? {
            type: 'Polygon',
            coordinates: polygons[0].geometry.coordinates,
          }
        : null;

      // 2. Точки старта
      const startPoints = markers.map((m, i) => ({
        id: `sp${i + 1}`,
        coordinates: [m.lng, m.lat], // API хочет [lon, lat]
      }));

      // 3. Выбранные модели из справочника
      const selectedModels = uavsData.uavs.filter((u) =>
        selectedUavs.includes(u.name)
      );

      // 3.1. uav_types — характеристики моделей
      const uavTypes = selectedModels.map((u) => ({
        id: u.id,                                 // берём id из json
        name: u.name,
        max_flight_time: u.max_flight_time,
        cruise_speed: u.cruise_speed,
        max_speed: u.max_speed,
        battery_capacity: u.battery_capacity,
        supported_survey_types: u.supported_survey_types,
      }));

      // 3.2. uavs — конкретные борта, по одному на каждый выбранный тип
      const uavs = uavTypes.map((t, i) => ({
        id: `uav_${i + 1}`,
        type_id: t.id,
      }));

      // 4. Payload
      const payload = {
        survey_area: surveyArea,
        start_points: startPoints,
        uav_types: uavTypes,          // ← обязательно
        uavs: uavs,                   // ← {id, type_id}, а не модели
        survey_type: surveyType,
        optimization_criteria: optimization,
      };

      // 5. Отправляем на бэкенд
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),})
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log('Ответ сервера:', data);
        alert('Задача отправлена');
      })
      .catch((err) => {
        console.error('Ошибка отправки:', err);
        alert('Не удалось отправить: ' + err.message);
      });
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
  }, [map, label, position, selectedUavs, surveyType, optimization]);

  return null;
}