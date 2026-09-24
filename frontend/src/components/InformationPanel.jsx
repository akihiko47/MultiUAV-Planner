export default function InformationPanel({ planResult }) {
  const hasResult = planResult?.uav_assignments?.length > 0;

  return (
    <div className="routes-panel">
      <h3>Сводка</h3>

      {!hasResult && (
        <p className="routes-empty">
          Запустите расчёт — здесь появится сводка
        </p>
      )}

      {hasResult && planResult.summary && (
        <div className="flight-summary">
          <p data-label="Время">
            {(planResult.summary.total_time / 60).toFixed(1)} мин
          </p>
          <p data-label="Дистанция">
            {(planResult.summary.total_distance / 1000).toFixed(2)} км
          </p>
          <p data-label="Дронов">
            {planResult.summary.uavs_used} из {planResult.summary.uavs_total}
          </p>
        </div>
      )}
    </div>
  );
}