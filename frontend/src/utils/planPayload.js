import uavsData from '../data/uavs.json' with { type: 'json' };
import camerasData from '../data/cameras.json' with { type: 'json' };
const UAV_CATALOG = uavsData.uavs;
const CAMERA_CATALOG = camerasData.cameras;
const SURVEY_TO_CAMERA_TYPE = { RGB: 'RGB', multispectral: 'Multispectral', Thermal: 'Thermal' };

/* ---------- 4. Построение payload ---------- */
export function buildPlan({
  mapData,
  selectedUavs,
  uavCounts,
  surveyType,
  gsd,
  optimization,
  startDate,
  uavCatalog = UAV_CATALOG,
  cameraCatalog = CAMERA_CATALOG,
}) {
  const selectedModels = uavCatalog.filter((u) => selectedUavs.includes(u.id));
  if (selectedModels.length === 0) {
    throw new Error('Не выбрано ни одного типа БВС.');
  }

  // GSD
  const gsdNum = Number(gsd);
  if (!Number.isFinite(gsdNum) || gsdNum <= 0) {
    throw new Error('Укажите корректное разрешение (GSD) больше 0.');
  }
  if (gsdNum < 0.1 || gsdNum > 100) {
    throw new Error('GSD должен быть в диапазоне 0.1–100 см/пиксель.');
  }

  const cameraType = SURVEY_TO_CAMERA_TYPE[surveyType];
  if (!cameraType) {
    throw new Error(
      `Тип съёмки "${surveyType}" не поддерживается каталогом камер.`
    );
  }

  const modelSupports = (model) =>
    (model.cameras || []).some((cid) => {
      const cam = cameraCatalog.find((c) => c.id === cid);
      return cam && cam.type === cameraType;
    });

  if (!selectedModels.some(modelSupports)) {
    throw new Error(
      `Ни один из выбранных БВС не поддерживает съёмку типа "${surveyType}".`
    );
  }

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

  const modelCameraMap = {};
  const usedCameraIds = new Set();

  selectedModels.forEach((model) => {
    const ids = model.cameras || [];
    const matching = ids.find((cid) => {
      const cam = cameraCatalog.find((c) => c.id === cid);
      return cam && cam.type === cameraType;
    });
    const chosen = matching || ids[0];
    if (chosen) {
      modelCameraMap[model.id] = chosen;
      usedCameraIds.add(chosen);
    }
  });

  const cameras = cameraCatalog
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
    gsd: gsdNum,
    optimization_criteria: optimization,
    operation_start_time: start ? start.toISOString() : null,
  };
}

