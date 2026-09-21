import L from 'leaflet';
import uavsData from '../data/uavs.json';

export function buildPayload(map, {
  selectedUavs = [],
  surveyType = 'RGB',
  optimization = 'min_time',
} = {}) {
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

  // 3. Выбранные модели
  const selectedModels = uavsData.uavs.filter((u) =>
    selectedUavs.includes(u.name)
  );

  // 3.1. uav_types
  const uavTypes = selectedModels.map((u) => ({
    id: u.id,
    name: u.name,
    max_flight_time: u.max_flight_time,
    cruise_speed: u.cruise_speed,
    max_speed: u.max_speed,
    battery_capacity: u.battery_capacity,
    supported_survey_types: u.supported_survey_types,
  }));

  // 3.2. uavs
  const uavs = uavTypes.map((t, i) => ({
    id: `uav_${i + 1}`,
    type_id: t.id,
  }));

  // 4. Итоговый payload
  const now = new Date();
  return {
    survey_area: surveyArea,
    start_points: startPoints,
    uav_types: uavTypes,
    uavs: uavs,
    survey_type: surveyType,
    optimization_criteria: optimization,
    operation_start_time: now.toISOString(),
    operation_end_time: new Date(now.getTime() + 3600_000).toISOString(),
  };
}