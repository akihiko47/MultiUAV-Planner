import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMission, positionAtTime, formatElapsed } from './missionPlayback.js';

const epoch = Date.parse('2026-10-20T07:25:00Z');
const iso = (seconds) => new Date(epoch + seconds * 1000).toISOString();
const assignment = (overrides = {}) => ({
  uav_id: 'uav1', takeoff_time: iso(0), landing_time: iso(100),
  route: { coordinates: [[37, 55], [37, 55.01], [37, 55.04]] },
  waypoints: [
    { coordinates: [37, 55], time: iso(0) },
    { coordinates: [37, 55.01], time: iso(20) },
    { coordinates: [37, 55.04], time: iso(100) },
  ],
  ...overrides,
});

test('movement follows waypoint times rather than uniform vertex progress', () => {
  const mission = buildMission([assignment()]);
  assert.equal(mission.approximate, false);
  assert.deepEqual(positionAtTime(mission.flights[0], epoch + 20000), [55.01, 37]);
  const midpoint = positionAtTime(mission.flights[0], epoch + 60000);
  assert.ok(Math.abs(midpoint[0] - 55.025) < 1e-9);
  assert.equal(positionAtTime(mission.flights[0], epoch - 1), null);
  assert.equal(positionAtTime(mission.flights[0], epoch + 100001), null);
  assert.deepEqual(positionAtTime(mission.flights[0], epoch + 100000), [55.04, 37]);
});

test('stationary and simultaneous waypoints support seeking backwards', () => {
  const flight = buildMission([assignment({ waypoints: [
    { coordinates: [37, 55], time: iso(0) },
    { coordinates: [37, 55], time: iso(10) },
    { coordinates: [37, 55.01], time: iso(20) },
    { coordinates: [37, 55.01], time: iso(20) },
    { coordinates: [37, 55.04], time: iso(90) },
    { coordinates: [37, 55.04], time: iso(100) },
  ] })]).flights[0];
  assert.deepEqual(positionAtTime(flight, epoch + 95000), [55.04, 37]);
  assert.deepEqual(positionAtTime(flight, epoch + 20000), [55.01, 37]);
  assert.deepEqual(positionAtTime(flight, epoch + 5000), [55, 37]);
});

test('staggered starts and repeat sorties share an operation clock with ground gaps', () => {
  const mission = buildMission([
    assignment({ uav_id: 'uav2', takeoff_time: iso(30), landing_time: iso(80), waypoints: [] }),
    assignment({ takeoff_time: iso(200), landing_time: iso(300), waypoints: [] }),
    assignment(),
  ]);
  assert.equal(mission.duration, 300);
  const group = mission.groups.find((item) => item.uavId === 'uav1');
  assert.equal(group.flights.length, 2);
  assert.equal(group.flights[0].start, epoch);
  assert.ok(group.flights.every((flight) => positionAtTime(flight, epoch + 150000) === null));
});

test('fallback interpolates by segment distance and rejects mismatched waypoint geometry', () => {
  for (const waypoints of [[], [{ coordinates: [1, 1], time: iso(0) }, { coordinates: [2, 2], time: iso(100) }]]) {
    const mission = buildMission([assignment({ waypoints })]);
    assert.equal(mission.approximate, true);
    assert.ok(Math.abs(positionAtTime(mission.flights[0], epoch + 25000)[0] - 55.01) < 1e-8);
  }
});

test('invalid and empty results produce no player; stationary route stays finite', () => {
  assert.equal(buildMission(), null);
  assert.equal(buildMission([assignment({ landing_time: 'invalid' })]), null);
  assert.equal(buildMission([assignment({ landing_time: iso(0) })]), null);
  assert.equal(buildMission([assignment({ route: { coordinates: [[NaN, 55]] } })]), null);
  const flight = buildMission([assignment({ route: { coordinates: [[37, 55]] }, waypoints: [] })]).flights[0];
  assert.deepEqual(positionAtTime(flight, epoch + 50000), [55, 37]);
  assert.equal(formatElapsed(3661.9), '01:01:01');
});

test('project fixture covers three drones and all scheduled landings', () => {
  const fixture = JSON.parse(readFileSync(new URL('../mocks/fixtures/planResponse.json', import.meta.url)));
  const mission = buildMission(fixture.uav_assignments);
  assert.equal(mission.groups.length, 3);
  assert.equal(mission.duration, fixture.summary.total_time);
  for (const flight of mission.flights) {
    const assignment = fixture.uav_assignments[flight.id];
    const [longitude, latitude] = assignment.route.coordinates.at(-1);
    assert.deepEqual(positionAtTime(flight, flight.end), [latitude, longitude]);
  }
});
