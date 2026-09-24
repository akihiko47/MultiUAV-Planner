import { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';

import { getRouteColor } from '../utils/routeColors';

function DirectionArrows({ assignments, hiddenRoutes }) {
  const map = useMap();

  useEffect(() => {
    if (!assignments || assignments.length === 0) return;

    const MIN_ZOOM = 13;

    const draw = () => {
      const layers = [];

      if (map.getZoom() < MIN_ZOOM) return layers;

      assignments.forEach((a, i) => {
        if (hiddenRoutes[a.uav_id]) return;

        const color = getRouteColor(i, assignments.length);
        const latlngs = a.route.coordinates.map(([lon, lat]) => [lat, lon]);

        const decorator = L.polylineDecorator(L.polyline(latlngs), {
          patterns: [
            {
              offset: 60,
              repeat: 120,
              symbol: L.Symbol.arrowHead({
                pixelSize: 10,
                polygon: true,
                pathOptions: {
                  fillColor: color,
                  fillOpacity: 1,
                  color: '#00000044',
                  weight: 1.1,
                },
              }),
            },
          ],
        }).addTo(map);

        decorator.options.pmIgnore = true;
        decorator.eachLayer((child) => {
          child.options.pmIgnore = true;
        });

        layers.push(decorator);
      });

      return layers;
    };

    let current = draw();

    const onZoomEnd = () => {
      current.forEach((l) => map.removeLayer(l));
      current = draw();
    };

    const onEditModeToggled = () => {
      current.forEach((l) => map.removeLayer(l));
      current = draw();
    };

    map.on('zoomend', onZoomEnd);
    map.on('pm:globaleditmodetoggled', onEditModeToggled);
    map.on('pm:globaldragmodetoggled', onEditModeToggled);

    return () => {
      map.off('zoomend', onZoomEnd);
      map.off('pm:globaleditmodetoggled', onEditModeToggled);
      map.off('pm:globaldragmodetoggled', onEditModeToggled);
      current.forEach((l) => map.removeLayer(l));
    };
  }, [map, assignments, hiddenRoutes]);

  return null;
}


export default function RoutesLayer({ assignments, hiddenRoutes }) {
  if (!assignments || assignments.length === 0) return null;

  return (
    <>
      {/* Чёрная обводка */}
      {assignments.map((a) => {
        if (hiddenRoutes[a.uav_id]) return null;

        const positions = a.route.coordinates.map(([lon, lat]) => [lat, lon]);

        return (
          <Polyline
            key={a.uav_id}
            positions={positions}
            pathOptions={{
              color: '#000',
              weight: 6,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round',
              pmIgnore: true,
            }}
          />
        );
      })}

      {/* Яркая линия поверх */}
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
              pmIgnore: true, 
            }}
          />
        );
      })}

      <DirectionArrows
        assignments={assignments}
        hiddenRoutes={hiddenRoutes}
      />
    </>
  );
}