import L from 'leaflet';
import uavsData from '../data/uavs.json';
import camerasData from '../data/cameras.json';
import JSZip from 'jszip';

const UAV_CATALOG = uavsData.uavs;
const CAMERA_CATALOG = camerasData.cameras;
const API_URL = '/api/v1/plan';

// Соответствие типа съёмки и типа камеры.
// LiDAR и geophysical в каталоге камер отсутствуют — для них ничего нет.
const SURVEY_TO_CAMERA_TYPE = {
  RGB: 'RGB',
  multispectral: 'Multispectral',
  Thermal: 'Thermal',
};

/* ---------- 1. Подбор камеры для модели БВС ---------- */
export function findSuitableCamera(model, surveyType) {
  const cameraType = SURVEY_TO_CAMERA_TYPE[surveyType];
  if (!cameraType) return null;
  const compatibleIds = model.cameras || [];
  return (
    CAMERA_CATALOG.find(
      (c) => compatibleIds.includes(c.id) && c.type === cameraType
    ) || null
  );
}

/* ---------- 2. Проверка совместимости ---------- */
export function checkCompatibility(selectedModels, surveyType) {
  const cameraType = SURVEY_TO_CAMERA_TYPE[surveyType];
  if (!cameraType) {
    return {
      ok: false,
      error:
        `Тип съёмки "${surveyType}" не поддерживается ни одной камерой ` +
        `из каталога. Доступные типы: RGB, multispectral, Thermal.`,
    };
  }

  const compatibleModels = selectedModels.filter((m) =>
    findSuitableCamera(m, surveyType)
  );

  if (compatibleModels.length === 0) {
    return {
      ok: false,
      error:
        `Ни один из выбранных БВС не поддерживает съёмку типа ` +
        `"${surveyType}". Выберите другие БВС или другой тип съёмки.`,
    };
  }

  return { ok: true, compatibleModels };
}

/* ---------- 3. Сбор данных с карты ---------- */
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

  const surveyArea = polygons[0]
    ? {
        type: 'Polygon',
        coordinates: polygons[0].geometry.coordinates,
      }
    : null;

  const startPoints = markers.map((m, i) => ({
    id: `sp${i + 1}`,
    coordinates: [m.lng, m.lat],
  }));

  return { surveyArea, startPoints };
}

/* ---------- 4. Построение payload ---------- */
export function buildPlan({
  mapData,
  selectedUavs,
  uavCounts,
  surveyType,
  optimization,
  startDate,
}) {
  const selectedModels = UAV_CATALOG.filter((u) => selectedUavs.includes(u.id));
  if (selectedModels.length === 0) {
    throw new Error('Не выбрано ни одного типа БВС.');
  }

  const cameraType = SURVEY_TO_CAMERA_TYPE[surveyType];
  if (!cameraType) {
    throw new Error(
      `Тип съёмки "${surveyType}" не поддерживается каталогом камер.`
    );
  }

  // Хотя бы одна модель должна быть способна на такую съёмку
  const modelSupports = (model) =>
    (model.cameras || []).some((cid) => {
      const cam = CAMERA_CATALOG.find((c) => c.id === cid);
      return cam && cam.type === cameraType;
    });

  if (!selectedModels.some(modelSupports)) {
    throw new Error(
      `Ни один из выбранных БВС не поддерживает съёмку типа "${surveyType}".`
    );
  }

  // 1. uav_types — ВСЕ выбранные модели
  const uavTypes = selectedModels.map((u) => ({
    id: u.id,
    name: u.name,
    max_flight_distance: u.max_flight_distance,
    max_distance_from_home: u.max_distance_from_home,
    cruise_speed: u.cruise_speed,
    min_speed: u.min_speed,
    max_speed: u.max_speed,
    min_alt: u.min_alt,
    max_alt: u.max_alt,
    min_turn_radius: u.min_turn_radius,
    min_voltage: u.min_voltage,
    climb_speed: u.climb_speed,
    descent_speed: u.descent_speed,
    cameras: u.cameras,
  }));

  // 2. Для каждой модели подбираем камеру
  const modelCameraMap = {};
  const usedCameraIds = new Set();

  selectedModels.forEach((model) => {
    const ids = model.cameras || [];
    const matching = ids.find((cid) => {
      const cam = CAMERA_CATALOG.find((c) => c.id === cid);
      return cam && cam.type === cameraType;
    });
    const chosen = matching || ids[0];
    if (chosen) {
      modelCameraMap[model.id] = chosen;
      usedCameraIds.add(chosen);
    }
  });

  // 3. cameras — только реально использованные
  const cameras = CAMERA_CATALOG
    .filter((c) => usedCameraIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      focalLength: c.focalLength,
      matrixX: c.matrixX,
      matrixY: c.matrixY,
      matrixPixX: c.matrixPixX,
      matrixPixY: c.matrixPixY,
    }));

  // 4. uavs — экземпляры ВСЕХ выбранных моделей
  const uavs = [];
  selectedModels.forEach((model) => {
    const cameraId = modelCameraMap[model.id];
    if (!cameraId) return;
    const count = Math.max(1, Number(uavCounts[model.id]) || 1);
    for (let i = 0; i < count; i++) {
      uavs.push({
        id: `uav${uavs.length + 1}`,
        type_id: model.id,
        camera_id: cameraId,
      });
    }
  });

  const start = startDate ? new Date(startDate) : new Date();

  return {
    survey_area: mapData.surveyArea,
    start_points: mapData.startPoints,
    uav_types: uavTypes,
    cameras,
    uavs,
    survey_type: surveyType,
    optimization_criteria: optimization,
    operation_start_time: start ? start.toISOString() : null,
  };
}
/* ---------- 5. Скачивание payload ---------- */
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

/* ---------- 6. Отправка ---------- */
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

/* ---------- 7. Импорт: восстановление карты из payload ---------- */
export function applyPlanToMap(map, plan, options = {}) {
  const { markerIcon } = options;

  const toRemove = [];
  map.eachLayer((layer) => {
    if (layer.options?.noSave) return;
    if (layer instanceof L.Polygon || layer instanceof L.Marker) {
      toRemove.push(layer);
    }
  });
  toRemove.forEach((l) => map.removeLayer(l));

  const added = [];

  if (plan.survey_area?.coordinates) {
    const rings = plan.survey_area.coordinates.map((ring) =>
      ring.map(([lon, lat]) => [lat, lon])
    );
    const poly = L.polygon(rings).addTo(map);
    added.push(poly);
  }

  if (Array.isArray(plan.start_points)) {
    plan.start_points.forEach((sp) => {
      const [lon, lat] = sp.coordinates;
      const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
      added.push(marker);
    });
  }

  if (added.length > 0) {
    const group = L.featureGroup(added);
    map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 18 });
  }
}

/* ---------- 8. Экспорт в Mission Planner (.waypoints) ---------- */
export async function downloadWaypointsZip(planResult) {
  const assignments = planResult?.uav_assignments;
  if (!assignments || assignments.length === 0) {
    alert('Нет маршрутов — сначала запусти расчёт');
    return;
  }

  const fmt = (n) => Number(n).toFixed(6);
  const line = (seq, cur, frame, cmd, p1, p2, p3, p4, lat, lon, alt, autocon) =>
    [
      seq,
      cur,
      frame,
      cmd,
      fmt(p1),
      fmt(p2),
      fmt(p3),
      fmt(p4),
      fmt(lat),
      fmt(lon),
      fmt(alt),
      autocon,
    ].join('\t');

  const ACTION_TO_CMD = {
    takeoff: 22,
    transit: 16,
    survey_end: 16,
    landing: 21,
  };

  const zip = new JSZip();

  assignments.forEach((a) => {
    const wps = a?.waypoints;
    if (!wps || wps.length === 0) return;

    const lines = ['QGC WPL 110'];
    let seq = 0;

    const [homeLon, homeLat] = a.start_point.coordinates;
    lines.push(line(seq++, 1, 0, 177, 0, 0, 0, 0, homeLat, homeLon, 0, 1));

    wps.forEach((wp) => {
      const [lon, lat] = wp.coordinates;
      const cmd = ACTION_TO_CMD[wp.action] ?? 16;
      const alt =
        wp.action === 'takeoff' && wp.altitude === 0 ? 100 : wp.altitude;
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