import { downloadWaypointsZip } from '../utils/plan';

export default function ExportPanel({ planResult, onDownloadResult }) {
  const hasResult = planResult?.uav_assignments?.length > 0;

  return (
    <div className="routes-panel">
      <h3>Экспорт</h3>

      {!hasResult && (
        <p className="routes-empty">
          Здесь появятся экспорты после расчёта
        </p>
      )}

      {hasResult && (
        <div className="export-actions">
          <button className="download-btn" onClick={onDownloadResult}>
            Экспорт JSON
          </button>
          <button
            className="download-btn"
            onClick={() => downloadWaypointsZip(planResult)}
          >
            Экспорт в Mission Planner
          </button>
        </div>
      )}
    </div>
  );
}