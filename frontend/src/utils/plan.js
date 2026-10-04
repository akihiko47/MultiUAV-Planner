import L from 'leaflet';
import camerasData from '../data/cameras.json';

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

export { buildPlan } from './planPayload';

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
