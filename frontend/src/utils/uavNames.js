const STORAGE_KEY = 'multiuav-planner.uav-names';

export const uavNameKey = (uavId, typeId) => `${typeId}:${uavId}`;
export const getUavName = (names, uavId, typeId) => names[uavNameKey(uavId, typeId)] || uavId;
export const isFixedWing = (model) => Number(model?.min_turn_radius) > 0;

export function loadUavNames() {
  try {
    const names = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!names || typeof names !== 'object' || Array.isArray(names)) return {};
    return Object.fromEntries(Object.entries(names)
      .filter(([, name]) => typeof name === 'string' && name.trim())
      .map(([key, name]) => [key, name.trim().slice(0, 40)]));
  } catch {
    return {};
  }
}

export function saveUavNames(names) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(names)); }
  catch { /* Names remain usable in this session if browser storage is unavailable. */ }
}
