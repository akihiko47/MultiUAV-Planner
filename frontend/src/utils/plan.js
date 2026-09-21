import L from 'leaflet';
import uavsData from '../data/uavs.json';
import JSZip from 'jszip';

const UAV_CATALOG = uavsData.uavs;
const API_URL = '/api/v1/plan';

/* ---------- 1. Сбор данных с карты ---------- */
export function collectMapData(map) {
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

  // survey_area — первый полигон. geometry.coordinates уже содержит
  // и внешний контур, и «дырки», если они есть — менять ничего не нужно.
  const surveyArea = polygons[0]
    ? {
        type: 'Polygon',
        coordinates: polygons[0].geometry.coordinates,
      }
    : null;

  // start_points — все маркеры в порядке добавления
  const startPoints = markers.map((m, i) => ({
    id: `sp${i + 1}`,
    coordinates: [m.lng, m.lat],   // API ждёт [lon, lat]
  }));

  return { surveyArea, startPoints };
}

/* ---------- 2. Построение payload ---------- */
export function buildPlan({
  mapData,
  selectedUavs,
  uavCounts,
  surveyType,
  optimization,
  startDate,
}) {
  // 2.1. Берём из справочника только выбранные модели
  const selectedModels = UAV_CATALOG.filter((u) => selectedUavs.includes(u.id));

  // 2.2. uav_types — характеристики
  const uavTypes = selectedModels.map((u) => ({
    id: u.id,
    name: u.name,
    max_flight_time: u.max_flight_time,
    cruise_speed: u.cruise_speed,
    max_speed: u.max_speed,
    battery_capacity: u.battery_capacity,
    supported_survey_types: u.supported_survey_types,
  }));

  // 2.3. uavs — конкретные борта.
  // Если модель выбрана с количеством 3 — создаём 3 записи с одним type_id.
  const uavs = [];
  selectedModels.forEach((model) => {
    const count = Math.max(1, Number(uavCounts[model.id]) || 1);
    for (let i = 0; i < count; i++) {
      uavs.push({
        id: `uav${uavs.length + 1}`,   // uav1, uav2, ...
        type_id: model.id,
      });
    }
  });

  // 2.4. Времена операции
  const start = startDate ? new Date(startDate) : new Date();

  // 2.5. Собираем итоговый объект
  return {
    survey_area: mapData.surveyArea,
    start_points: mapData.startPoints,
    uav_types: uavTypes,
    uavs,
    survey_type: surveyType,
    optimization_criteria: optimization,
    operation_start_time: start ? start.toISOString() : null,
  };
}

/* ---------- 3. Действия с payload ---------- */
export function downloadPlan(plan) {
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sendPlan(plan) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

/* ---------- 4. Импорт: восстановление карты из payload ---------- */
export function applyPlanToMap(map, plan, options = {}) {
  const { markerIcon } = options;

  // 1. Удаляем пользовательские слои (зоны с noSave не трогаем)
  const toRemove = [];
  map.eachLayer((layer) => {
    if (layer.options?.noSave) return;
    if (layer instanceof L.Polygon || layer instanceof L.Marker) {
      toRemove.push(layer);
    }
  });
  toRemove.forEach((l) => map.removeLayer(l));

  const added = [];

  // 2. Полигон
  if (plan.survey_area?.coordinates) {
    const rings = plan.survey_area.coordinates.map((ring) =>
      ring.map(([lon, lat]) => [lat, lon])
    );
    const poly = L.polygon(rings).addTo(map);
    added.push(poly);
  }

  // 3. Маркеры — с переданной иконкой, если она есть
  if (Array.isArray(plan.start_points)) {
    plan.start_points.forEach((sp) => {
      const [lon, lat] = sp.coordinates;
      const marker = L.marker([lat, lon], {
        icon: markerIcon,   // ← если undefined, Leaflet возьмёт дефолтную
      }).addTo(map);
      added.push(marker);
    });
  }

  // 4. Подгоняем вид
  if (added.length > 0) {
    const group = L.featureGroup(added);
    map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 18 });
  }
}

/* ---------- 5. Экспорт всего плана в Mission Planner (.waypoints) ---------- */
export async function downloadWaypointsZip(planResult) {
  const assignments = planResult?.uav_assignments;
  if (!assignments || assignments.length === 0) {
    alert('Нет маршрутов — сначала запусти расчёт');
    return;
  }

  const fmt = (n) => Number(n).toFixed(6);
  const line = (seq, cur, frame, cmd, p1, p2, p3, p4, lat, lon, alt, autocon) =>
    [seq, cur, frame, cmd,
      fmt(p1), fmt(p2), fmt(p3), fmt(p4),
      fmt(lat), fmt(lon), fmt(alt), autocon].join('\t');

  const ACTION_TO_CMD = {
    takeoff: 22,
    transit: 16,
    survey_end: 16,
    landing: 21,
  };

  const zip = new JSZip();

  assignments.forEach((a) => {
    console.log('=== Обрабатываю', a.uav_id, '===');
    console.log('route:', a.route.coordinates);
    console.log('waypoints:', a.waypoints.map(w => w.coordinates));
    const wps = a?.waypoints;
    if (!wps || wps.length === 0) return;

    const lines = ['QGC WPL 110'];
    let seq = 0;

    const [homeLon, homeLat] = a.start_point.coordinates;
    lines.push(line(seq++, 1, 0, 177, 0, 0, 0, 0, homeLat, homeLon, 0, 1));

    wps.forEach((wp) => {
      const [lon, lat] = wp.coordinates;
      const cmd = ACTION_TO_CMD[wp.action] ?? 16;
      const alt = (wp.action === 'takeoff' && wp.altitude === 0) ? 100 : wp.altitude;
      lines.push(line(seq++, 0, 3, cmd, 0, 0, 0, 0, lat, lon, alt, 1));
    });

    zip.file(`${a.uav_id}.waypoints`, lines.join('\n'));
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plan_waypoints.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}