const validCoordinate = (point) => Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1]);
const samePoint = (a, b) => Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8;
const withoutRepeats = (points) => points.filter((point, i) => i === 0 || !samePoint(point, points[i - 1]));

function distance(a, b) {
  const radians = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * radians / 2) ** 2
    + Math.cos(a[1] * radians) * Math.cos(b[1] * radians)
    * Math.sin((b[0] - a[0]) * radians / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Preserve waypoint timing, including stationary climb/descent and repeated points.
// Older results without usable waypoint times use constant speed along the route.
export function buildMission(assignments = []) {
  const uavIds = [...new Set(assignments.map((assignment) => assignment.uav_id))];
  const flights = assignments.flatMap((assignment, index) => {
    const start = Date.parse(assignment.takeoff_time);
    const end = Date.parse(assignment.landing_time);
    const route = assignment.route?.coordinates;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
      || !route?.length || !route.every(validCoordinate)) return [];

    const waypoints = assignment.waypoints || [];
    const timed = waypoints.map((point) => ({ coordinates: point.coordinates, time: Date.parse(point.time) }));
    const usable = timed.length >= 2 && timed.every((point, i) => validCoordinate(point.coordinates)
      && Number.isFinite(point.time) && point.time >= start && point.time <= end
      && (i === 0 || point.time >= timed[i - 1].time));
    const path = usable ? withoutRepeats(timed.map((point) => point.coordinates)) : [];
    const routePath = withoutRepeats(route);
    const exact = usable && path.length === routePath.length
      && path.every((point, i) => samePoint(point, routePath[i]));
    let points;
    if (exact) {
      points = [{ coordinates: route[0], time: start }, ...timed, { coordinates: route.at(-1), time: end }];
    } else {
      const lengths = [0];
      for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + distance(route[i - 1], route[i]));
      const total = lengths.at(-1);
      points = route.map((coordinates, i) => ({
        coordinates,
        time: start + (end - start) * (total > 0 ? lengths[i] / total : i / Math.max(1, route.length - 1)),
      }));
      if (points.length === 1) points.push({ coordinates: route[0], time: end });
    }
    return [{ id: index, uavId: assignment.uav_id, start, end, points, approximate: !exact }];
  });
  if (!flights.length) return null;
  const start = Math.min(...flights.map((flight) => flight.start));
  const end = Math.max(...flights.map((flight) => flight.end));
  return {
    start, end, duration: (end - start) / 1000, flights,
    groups: uavIds.filter((uavId) => flights.some((flight) => flight.uavId === uavId))
      .map((uavId) => ({ uavId, typeId: assignments.find((assignment) => assignment.uav_id === uavId)?.type_id,
        colorIndex: uavIds.indexOf(uavId), flights: flights.filter((flight) => flight.uavId === uavId).sort((a, b) => a.start - b.start) })),
    colorCount: uavIds.length,
    approximate: flights.some((flight) => flight.approximate),
  };
}

export function positionAtTime(flight, time) {
  const points = flight.points;
  if (time < flight.start || time > flight.end) return null;
  // Upper bound makes zero-duration waypoint transitions deterministic on seek.
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (points[middle].time <= time) low = middle + 1;
    else high = middle;
  }
  const a = points[Math.max(0, low - 1)];
  const b = points[Math.min(points.length - 1, low)];
  const fraction = b.time > a.time ? (time - a.time) / (b.time - a.time) : 0;
  return [a.coordinates[1] + (b.coordinates[1] - a.coordinates[1]) * fraction,
    a.coordinates[0] + (b.coordinates[0] - a.coordinates[0]) * fraction];
}

export function formatElapsed(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
}
