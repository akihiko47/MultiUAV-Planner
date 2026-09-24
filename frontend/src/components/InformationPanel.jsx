export default function InformationPanel({ planResult }) {
  const hasResult = planResult?.uav_assignments?.length > 0;

  return (
    <div className="routes-panel">
      <h3>Информация</h3>

      {!hasResult && (
        <p className="routes-empty">
          Здесь отобразится сводка о полёте
        </p>
      )}

      {hasResult && planResult.summary && (
        <div className="flight-summary">
          <p>Время: {(planResult.summary.total_time / 60).toFixed(1)} мин</p>
          <p>Дистанция: {(planResult.summary.total_distance / 1000).toFixed(2)} км</p>
          <p>Дронов: {planResult.summary.uavs_used} из {planResult.summary.uavs_total}</p>
        </div>
      )}
    </div>
  );
}