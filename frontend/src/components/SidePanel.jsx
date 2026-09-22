import { useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import GithubButton from './GithubButton';
import UavSelector from './UavSelector';
import RoutesPanel from './RoutesPanel';
import ExportPanel from './ExportPanel';

export default function SidePanel({
  uavs,
  selectedUavs,
  setSelectedUavs,
  uavCounts,
  setUavCounts,
  surveyType,
  setSurveyType,
  optimization,
  setOptimization,
  startDate,
  setStartDate,
  onSubmit,
  onDownloadResult,
  onDownloadPayload,
  planResult,
  onImport,
  isSending,
  assignments,
  hiddenRoutes,
  onToggleRoute,
  isOpen,
  onClose,
}) {
  const fileInputRef = useRef(null);
  console.log('=== planResult в SidePanel ===');
  console.log(planResult);
  if (planResult?.uav_assignments) {
    planResult.uav_assignments.forEach((a) => {
      console.log(a.uav_id, '→ route[0]:', a.route?.coordinates?.[0], '| waypoint[0]:', a.waypoints?.[0]?.coordinates);
    });
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onImport(data);
      } catch (err) {
        alert('Не удалось прочитать файл: ' + err.message);
      }
    };
    reader.onerror = () => alert('Ошибка чтения файла');
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <aside className={`side-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <ThemeToggle />
        <div className="panel-header-right">
          <GithubButton />
          {/* крестик на мобильном */}
          <button
            className="panel-close-btn"
            onClick={onClose}
            aria-label="Закрыть панель"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <UavSelector
        uavs={uavs}
        selected={selectedUavs}
        onChange={setSelectedUavs}
        uavCounts={uavCounts}
        onCountsChange={setUavCounts}
      />

      <div className="form-field">
        <h3>Дата и время начала</h3>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        {!startDate && (
          <small className="form-hint">
            Не указано — будет использовано текущее время
          </small>
        )}
      </div>

      <div className="form-field">
        <h3>Тип съёмки</h3>
        <select value={surveyType} onChange={(e) => setSurveyType(e.target.value)}>
          <option value="RGB">RGB</option>
          <option value="LiDAR">Лидар</option>
          <option value="multispectral">Мультиспектральная</option>
          <option value="IR">IR</option>
          <option value="geophysical">Геофизическая</option>
        </select>
      </div>

      <div className="form-field">
        <h3>Оптимизировать по</h3>
        <select value={optimization} onChange={(e) => setOptimization(e.target.value)}>
          <option value="min_time">Минимальному времени</option>
          <option value="min_flight_distance">Суммарному налёту</option>
        </select>
      </div>

      <RoutesPanel
        assignments={assignments}
        hiddenRoutes={hiddenRoutes}
        onToggle={onToggleRoute}
      />

      <ExportPanel
      planResult={planResult}
      onDownloadResult={onDownloadResult}
    />

      <div className="panel-actions">
        <div className="panel-actions-row">
          <button className="download-btn" onClick={onDownloadPayload}>
            Экспорт запроса
          </button>
          <button
            className="download-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Импорт запроса
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button className="submit-btn" onClick={onSubmit} disabled={isSending}>
          {isSending ? 'Считаем…' : 'Запустить расчёт'}
        </button>
      </div>
    </aside>
  );
}