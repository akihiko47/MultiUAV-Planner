import { Polyline } from 'react-leaflet';
import { getRouteColor } from '../utils/routeColors';

export default function RoutesLayer({ assignments, hiddenRoutes }) {
  if (!assignments || assignments.length === 0) return null;

  return (
    <>
      {assignments.map((a, i) => {
        if (hiddenRoutes[a.uav_id]) return null;

        const color = getRouteColor(i, assignments.length);
        const positions = a.route.coordinates.map(([lon, lat]) => [lat, lon]);

        return (
          <Polyline
            key={a.uav_id}
            positions={positions}
            pathOptions={{
              color: '#000',       // сначала чёрная обводка
              weight: 6,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        );
      })}

      {/* Второй проход — яркая линия поверх обводки */}
      {assignments.map((a, i) => {
        if (hiddenRoutes[a.uav_id]) return null;

        const color = getRouteColor(i, assignments.length);
        const positions = a.route.coordinates.map(([lon, lat]) => [lat, lon]);

        return (
          <Polyline
            key={a.uav_id + '_top'}
            positions={positions}
            pathOptions={{
              color,
              weight: 3,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        );
      })}
    </>
  );
}