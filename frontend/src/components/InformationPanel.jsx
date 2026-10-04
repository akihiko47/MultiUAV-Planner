export default function InformationPanel({ planResult }) {
  const hasResult = planResult?.uav_assignments?.length > 0;

  return (
    <div className="routes-panel summary-panel">
      <h3>Показатели миссии</h3>

      {!hasResult && (
        <p className="routes-empty">
          Запустите расчёт — здесь появится сводка
        </p>
      )}

      {hasResult && planResult.summary && (
        <div className="flight-summary">
          <div><span>Время</span><strong>{(planResult.summary.total_time / 60).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}<small>мин</small></strong></div>
          <div><span>Дистанция</span><strong>{(planResult.summary.total_distance / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}<small>км</small></strong></div>
          <div><span>Бортов</span><strong>{planResult.summary.uavs_used}<small>из {planResult.summary.uavs_total}</small></strong></div>
        </div>
      )}
    </div>
  );
}
