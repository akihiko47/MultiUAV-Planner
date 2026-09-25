import { downloadMissionPlannerZip, downloadGeoscanKml } from '../utils/exportApi';

export default function ExportPanel({ planResult, onDownloadResult }) {
  const hasResult = planResult?.uav_assignments?.length > 0;

  const handleMissionPlanner = async () => {
    try {
      await downloadMissionPlannerZip(planResult);
    } catch (e) {
      alert('Ошибка экспорта в Mission Planner: ' + e.message);
    }
  };

  const handleGeoscan = async () => {
    try {
      await downloadGeoscanKml(planResult);
    } catch (e) {
      alert('Ошибка экспорта в Geoscan Planner: ' + e.message);
    }
  };

  return (
    <div className="routes-panel">
      <h3>Экспорт</h3>

      {!hasResult && (
        <p className="routes-empty">
          Запустите расчёт — здесь появятся варианты экспорта
        </p>
      )}

      {hasResult && (
        <div className="export-actions">
          <button className="download-btn" onClick={onDownloadResult}>
            Экспорт JSON
          </button>
          <button className="download-btn" onClick={handleMissionPlanner}>
            Экспорт в Mission Planner
          </button>
          <button className="download-btn" onClick={handleGeoscan}>
            Экспорт в Geoscan Planner (KML)
          </button>
        </div>
      )}
    </div>
  );
}