import { useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import GithubButton from './GithubButton';
import UavSelector from './UavSelector';
import RoutesPanel from './RoutesPanel';
import ExportPanel from './ExportPanel';
import InformationPanel from './InformationPanel'; 

export default function SidePanel({
  uavs,
  selectedUavs,
  setSelectedUavs,
  uavCounts,
  setUavCounts,
  surveyType,
  setSurveyType,
  gsd,
  setGsd,
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
          <option value="multispectral">Мультиспектральная</option>
          <option value="Thermal">Тепловизионная (Thermal)</option>
        </select>
      </div>

      <div className="form-field">
        <h3>Разрешение (GSD)</h3>
        <input
          type="number"
          min="0.1"
          max="100"
          step="0.1"
          value={gsd}
          onChange={(e) => setGsd(e.target.value)}
        />
        <small className="form-hint">
          Пространственное разрешение, см/пиксель. Диапазон: 0.1–100.
        </small>
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

      <InformationPanel planResult={planResult} />

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