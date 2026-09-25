import { useMemo } from 'react';
import { getRouteColor } from '../utils/routeColors';

export default function RoutesPanel({ assignments, hiddenRoutes, onToggle }) {
  const hasRoutes = assignments && assignments.length > 0;

  // Группируем по uav_id: одна строка на борт, независимо от числа вылетов
  const groups = useMemo(() => {
    if (!hasRoutes) return [];
    const map = new Map();
    assignments.forEach((a) => {
      if (!map.has(a.uav_id)) {
        map.set(a.uav_id, {
          uav_id: a.uav_id,
          type_id: a.type_id,
          sorties: 0,
        });
      }
      map.get(a.uav_id).sorties += 1;
    });
    return Array.from(map.values());
  }, [assignments, hasRoutes]);

  const uavIds = groups.map((g) => g.uav_id);

  return (
    <div className="routes-panel">
      <h3>Маршруты</h3>

      {!hasRoutes && (
        <p className="routes-empty">
          Запустите расчёт — здесь появятся маршруты
        </p>
      )}

      {hasRoutes && groups.map((g) => {
        const color = getRouteColor(uavIds.indexOf(g.uav_id), uavIds.length);
        const isVisible = !hiddenRoutes[g.uav_id];

        return (
          <label key={g.uav_id} className="route-item">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => onToggle(g.uav_id)}
            />
            <span className="route-swatch" style={{ background: color }} />
            <span className="route-label">
              {g.uav_id}
              <span className="route-type">
                {g.type_id}
                {g.sorties > 1 && ` · ${g.sorties} вылетов`}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}