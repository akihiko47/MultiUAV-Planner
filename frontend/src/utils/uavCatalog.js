export const CATALOG_STORAGE_KEY = 'multiuav-planner.uav-catalog.v1';

// Bounds match the planner's RequestParser.
export const UAV_FIELDS = [
  ['max_flight_distance', 'Максимальный налёт, м', 0.01, 1e8],
  ['max_distance_from_home', 'Удаление от точки взлёта, м', 0.01, 1e7],
  ['cruise_speed', 'Крейсерская скорость, м/с', 0.01, 1000],
  ['min_speed', 'Минимальная скорость, м/с', 0, 1000],
  ['max_speed', 'Максимальная скорость, м/с', 0.01, 1000],
  ['min_alt', 'Минимальная высота, м', 0, 100000],
  ['max_alt', 'Максимальная высота, м', 0.01, 100000],
  ['min_turn_radius', 'Радиус разворота, м', 0, 100000],
  ['min_voltage', 'Минимальное напряжение, В', 0, Number.MAX_VALUE],
  ['climb_speed', 'Скорость набора высоты, м/с', 0.001, 1000],
  ['descent_speed', 'Скорость снижения, м/с', 0.001, 1000],
];

export function normalizeUav(input, cameras) {
  if (!input || typeof input.id !== 'string' || !input.id.trim()) throw new Error('Не указан идентификатор модели.');
  if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('Укажите название модели.');
  const model = { id: input.id.trim(), name: input.name.trim() };
  for (const [key, label, min, max] of UAV_FIELDS) {
    const value = input[key];
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ||
        !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) {
      throw new Error(`${label}: допустимый диапазон ${min}–${max}.`);
    }
    model[key] = Number(value);
  }
  if (model.min_speed > model.cruise_speed || model.cruise_speed > model.max_speed) {
    throw new Error('Крейсерская скорость должна быть между минимальной и максимальной.');
  }
  if (model.min_alt > model.max_alt) throw new Error('Минимальная высота не может превышать максимальную.');
  if (model.min_turn_radius === 0 && model.min_speed > 0) {
    throw new Error('При нулевом радиусе разворота минимальная скорость должна быть равна 0.');
  }
  if (model.min_turn_radius > 0 && model.min_turn_radius < 0.01) throw new Error('Радиус разворота должен быть равен 0 или не меньше 0,01 м.');
  if (!Array.isArray(input.cameras) || !input.cameras.length || input.cameras.some(id => !cameras.some(camera => camera.id === id))) {
    throw new Error('Выберите хотя бы одну камеру из каталога.');
  }
  model.cameras = [...new Set(input.cameras)];
  return model;
}

export function mergeCatalog(current, incoming) {
  return [...current.filter(item => !incoming.some(next => next.id === item.id)), ...incoming];
}

export function importUavCatalog(current, plan) {
  if (!Array.isArray(plan.uav_types)) return current;
  const importedCameras = plan.cameras ?? [];
  if (!Array.isArray(importedCameras)) throw new Error('Некорректный список камер.');
  for (const camera of importedCameras) {
    if (!camera || typeof camera.id !== 'string' || !camera.id.trim() ||
        !['RGB', 'Multispectral', 'Thermal'].includes(camera.type) ||
        ['focalLength', 'matrixX', 'matrixY', 'matrixPixX', 'matrixPixY'].some(key =>
          typeof camera[key] !== 'number' || !Number.isFinite(camera[key]) || camera[key] <= 0) ||
        !Number.isInteger(camera.matrixPixX) || !Number.isInteger(camera.matrixPixY)) {
      throw new Error('Некорректные параметры импортируемой камеры.');
    }
  }
  const cameras = mergeCatalog(current.cameras, importedCameras);
  // Exported requests contain only installed cameras; retain other compatible cameras
  // if they are known locally, and discard references absent from both catalogs.
  const uavs = plan.uav_types.map(model => normalizeUav({ ...model,
    name: model.name || model.id,
    cameras: Array.isArray(model.cameras) ? model.cameras.filter(id => cameras.some(camera => camera.id === id)) : [],
  }, cameras));
  if (new Set(uavs.map(model => model.id)).size !== uavs.length) throw new Error('Идентификаторы моделей должны быть уникальными.');
  if (new Set(importedCameras.map(camera => camera.id)).size !== importedCameras.length) throw new Error('Идентификаторы камер должны быть уникальными.');
  return { uavs: mergeCatalog(current.uavs, uavs), cameras };
}

export function loadUavCatalog(defaults, storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(CATALOG_STORAGE_KEY) || 'null');
    return saved ? importUavCatalog(defaults, { uav_types: saved.uavs, cameras: saved.cameras }) : defaults;
  } catch { return defaults; }
}

export function saveUavCatalog(catalog, storage = globalThis.localStorage) {
  try { storage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog)); }
  catch { throw new Error('Браузер не смог сохранить каталог. Проверьте доступ к локальному хранилищу и повторите сохранение.'); }
}
