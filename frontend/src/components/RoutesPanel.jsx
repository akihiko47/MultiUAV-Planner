import { getRouteColor } from '../utils/routeColors';

export default function RoutesPanel({ assignments, hiddenRoutes, onToggle }) {
  const hasRoutes = assignments && assignments.length > 0;

  return (
    <div className="routes-panel">
      <h3>Маршруты</h3>

      {!hasRoutes && (
        <p className="routes-empty">
          Запустите расчёт — здесь появятся маршруты
        </p>
      )}

      {hasRoutes && assignments.map((a, i) => {
        const color = getRouteColor(i, assignments.length);
        const isVisible = !hiddenRoutes[a.uav_id];

        return (
          <label key={a.uav_id} className="route-item">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={() => onToggle(a.uav_id)}
            />
            <span className="route-swatch" style={{ background: color }} />
            <span className="route-label">
              {a.uav_id}
              <span className="route-type">{a.type_id}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}