import test from 'node:test';
import assert from 'node:assert/strict';
import uavsData from '../data/uavs.json' with { type: 'json' };
import camerasData from '../data/cameras.json' with { type: 'json' };
import { normalizeUav, importUavCatalog, loadUavCatalog, saveUavCatalog, CATALOG_STORAGE_KEY } from './uavCatalog.js';
import { buildPlan } from './planPayload.js';

const defaults = { uavs: uavsData.uavs, cameras: camerasData.cameras };
const model = { ...defaults.uavs[1], id: 'custom_test', name: 'Мой дрон', cruise_speed: 12, max_flight_distance: 12345 };
const settings = {
  mapData: { surveyArea: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, startPoints: [{ id: 'sp1', coordinates: [0, 0] }] },
  selectedUavs: [model.id], uavCounts: { [model.id]: 2 }, surveyType: 'RGB', gsd: '3', optimization: 'min_time',
};
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
};

test('numeric input is normalized; invalid values and inconsistent limits are rejected', () => {
  assert.equal(normalizeUav({ ...model, cruise_speed: '10' }, defaults.cameras).cruise_speed, 10);
  for (const patch of [{ cruise_speed: '' }, { cruise_speed: Infinity }, { max_flight_distance: -1 },
    { cruise_speed: 16 }, { min_alt: 5000 }, { min_speed: 1 }, { min_turn_radius: 0.001 },
    { climb_speed: 0.0001 }, { max_alt: 100001 }, { cameras: [] }, { cameras: ['missing'] }, { name: '  ' }]) {
    assert.throws(() => normalizeUav({ ...model, ...patch }, defaults.cameras));
  }
});

test('custom and edited models survive reload and reach the calculation payload', () => {
  const edited = { ...defaults.uavs[0], cruise_speed: 22, name: 'Изменённая модель' };
  const catalog = importUavCatalog(defaults, { uav_types: [model, edited] });
  const storage = memoryStorage();
  saveUavCatalog(catalog, storage);
  const loaded = loadUavCatalog(defaults, storage);
  assert.equal(loaded.uavs.find(item => item.id === edited.id).cruise_speed, 22);
  const payload = buildPlan({ ...settings, uavCatalog: loaded.uavs, cameraCatalog: loaded.cameras });
  assert.equal(payload.uav_types[0].max_flight_distance, 12345);
  assert.equal(payload.uav_types[0].cruise_speed, 12);
  assert.equal(payload.uavs.length, 2);
  assert.equal(payload.uavs[0].type_id, model.id);
  assert.ok(payload.cameras.some(camera => camera.id === payload.uavs[0].camera_id));
});

test('export/import round trip restores custom models and cameras in a fresh catalog', () => {
  const camera = { ...defaults.cameras[0], id: 'custom_camera', focalLength: 25 };
  const custom = { ...model, cameras: [camera.id] };
  const payload = buildPlan({ ...settings, uavCatalog: [custom], cameraCatalog: [camera] });
  const imported = importUavCatalog(defaults, JSON.parse(JSON.stringify(payload)));
  const rebuilt = buildPlan({ ...settings, uavCatalog: imported.uavs, cameraCatalog: imported.cameras,
    startDate: payload.operation_start_time });
  assert.deepEqual(rebuilt, payload);
});

test('invalid imports do not mutate the catalog; broken storage falls back safely', () => {
  const snapshot = JSON.stringify(defaults);
  assert.throws(() => importUavCatalog(defaults, { uav_types: [{ ...model, max_speed: 1 }] }));
  assert.throws(() => importUavCatalog(defaults, { uav_types: [model, model] }));
  assert.equal(JSON.stringify(defaults), snapshot);
  const storage = memoryStorage();
  storage.setItem(CATALOG_STORAGE_KEY, '{broken');
  assert.equal(loadUavCatalog(defaults, storage), defaults);
  assert.throws(() => saveUavCatalog(defaults, { setItem() { throw new Error('quota'); } }), /не смог сохранить/);
});

test('camera compatibility uses the edited selection', () => {
  assert.throws(() => buildPlan({ ...settings, uavCatalog: [{ ...model, cameras: ['geoscan_801_thermal'] }] }), /не поддерживает/);
});
