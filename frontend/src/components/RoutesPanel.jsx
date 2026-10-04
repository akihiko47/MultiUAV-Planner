import { useMemo } from 'react';
import { getRouteColor } from '../utils/routeColors';
import { getUavName } from '../utils/uavNames';
import uavsData from '../data/uavs.json';

export default function RoutesPanel({ assignments, hiddenRoutes, onToggle, uavNames, onRename }) {
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
      {hasRoutes && <small className="form-hint">Нажмите на название борта, чтобы изменить его.</small>}

      {!hasRoutes && (
        <p className="routes-empty">
          Запустите расчёт — здесь появятся маршруты
        </p>
      )}

      {hasRoutes && groups.map((g) => {
        const color = getRouteColor(uavIds.indexOf(g.uav_id), uavIds.length);
        const isVisible = !hiddenRoutes[g.uav_id];

        return (
          <div key={g.uav_id} className="route-item">
            <label className="route-visibility">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => onToggle(g.uav_id)}
              aria-label={`Показать маршрут ${getUavName(uavNames, g.uav_id, g.type_id)}`}
            />
            </label>
            <span className="route-swatch" style={{ background: color }} />
            <span className="route-label">
              <input className="route-name" type="text" maxLength={40}
                aria-label={`Название борта ${g.uav_id}`}
                title="Изменить название борта · Enter — сохранить, Escape — отменить"
                key={getUavName(uavNames, g.uav_id, g.type_id)}
                defaultValue={getUavName(uavNames, g.uav_id, g.type_id)}
                onBlur={(event) => {
                  onRename(g.uav_id, g.type_id, event.target.value);
                  event.target.value = event.target.value.trim() || g.uav_id;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    event.currentTarget.value = getUavName(uavNames, g.uav_id, g.type_id);
                    event.currentTarget.blur();
                  }
                }} />
              <span className="route-type">
                {uavsData.uavs.find((model) => model.id === g.type_id)?.name || g.type_id}
                {g.sorties > 1 && ` · ${g.sorties} вылетов`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
