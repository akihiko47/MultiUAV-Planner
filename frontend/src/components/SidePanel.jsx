import { useEffect, useRef, useState } from 'react';
import UavSelector from './UavSelector';
import RoutesPanel from './RoutesPanel';
import ExportPanel from './ExportPanel';
import InformationPanel from './InformationPanel'; 

export default function SidePanel({
  panelView,
  setPanelView,
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
  uavNames,
  onRenameUav,
  isOpen,
  onClose,
}) {
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1100px)').matches);
  const hasResult = assignments?.length > 0;
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const content = panelRef.current?.querySelector('.panel-scroll');
    if (content) content.scrollTop = 0;
  }, [panelView, assignments]);
  useEffect(() => {
    if (!compact || !isOpen) return;
    const previous = document.activeElement;
    const panel = panelRef.current;
    panel.querySelector('.panel-close-btn')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = [...panel.querySelectorAll('button:not(:disabled), a, input:not([type="file"]), select')]
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener('keydown', handleKey);
    return () => { panel.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [compact, isOpen, onClose]);

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
    <aside id="mission-side-panel" ref={panelRef} className={`side-panel ${isOpen ? 'open' : ''}`}
      inert={compact && !isOpen ? true : undefined} aria-label="Настройки и результаты миссии"
      role={compact ? 'dialog' : undefined} aria-modal={compact && isOpen ? true : undefined}>
      <div className="panel-header">
        <h2>Параметры миссии</h2>
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
      <div className="panel-tabs" role="tablist" aria-label="Разделы миссии"
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'planning' : event.key === 'End' ? 'results'
            : panelView === 'planning' ? 'results' : 'planning';
          setPanelView(next);
          event.currentTarget.querySelector(`#tab-${next}`)?.focus();
        }}>
        <button id="tab-planning" type="button" role="tab" aria-selected={panelView === 'planning'}
          aria-controls="mission-panel-content" tabIndex={panelView === 'planning' ? 0 : -1}
          onClick={() => setPanelView('planning')}>Планирование</button>
        <button id="tab-results" type="button" role="tab" aria-selected={panelView === 'results'}
          aria-controls="mission-panel-content" tabIndex={panelView === 'results' ? 0 : -1}
          onClick={() => setPanelView('results')}>Результат</button>
      </div>
      <div id="mission-panel-content" className="panel-scroll" role="tabpanel"
        aria-labelledby={`tab-${panelView}`} tabIndex={0}>
      {panelView === 'planning' ? <>
      <section className="planning-section" aria-labelledby="fleet-heading">
      <div className="section-heading"><span>01</span><h3 id="fleet-heading">Воздушный флот</h3></div>
      <UavSelector
        uavs={uavs}
        selected={selectedUavs}
        onChange={setSelectedUavs}
        uavCounts={uavCounts}
        onCountsChange={setUavCounts}
      />
      </section>
      <section className="planning-section" aria-labelledby="survey-heading">
      <div className="section-heading"><span>02</span><h3 id="survey-heading">Параметры съёмки</h3></div>
      <div className="form-field">
        <label htmlFor="mission-start">Дата и время начала</label>
        <input
          id="mission-start"
          aria-describedby="mission-start-hint"
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <small id="mission-start-hint" className="form-hint">
          {startDate ? 'Время в вашем часовом поясе' : 'Не указано — будет использовано текущее время'}
        </small>
      </div>

      <div className="form-field">
        <label htmlFor="survey-type">Тип съёмки</label>
        <select id="survey-type" value={surveyType} onChange={(e) => setSurveyType(e.target.value)}>
          <option value="RGB">RGB</option>
          <option value="multispectral">Мультиспектральная</option>
          <option value="Thermal">Тепловизионная (Thermal)</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="survey-gsd">Разрешение (GSD)</label>
        <input
          id="survey-gsd"
          aria-describedby="survey-gsd-hint"
          type="number"
          min="0.1"
          max="100"
          step="0.1"
          value={gsd}
          onChange={(e) => setGsd(e.target.value)}
        />
        <small id="survey-gsd-hint" className="form-hint">
          см/пиксель · диапазон 0,1–100
        </small>
      </div>

      <div className="form-field">
        <label htmlFor="optimization">Критерий оптимизации</label>
        <select id="optimization" value={optimization} onChange={(e) => setOptimization(e.target.value)}>
          <option value="min_time">Минимальному времени</option>
          <option value="min_flight_distance">Суммарному налёту</option>
        </select>
      </div>
      </section>
      </> : hasResult ? <>
      <InformationPanel planResult={planResult} />
      <RoutesPanel
        assignments={assignments}
        hiddenRoutes={hiddenRoutes}
        onToggle={onToggleRoute}
        uavNames={uavNames}
        onRename={onRenameUav}
      />

      <ExportPanel
        planResult={planResult}
        onDownloadResult={onDownloadResult}
      />
      </> : <div className="result-empty">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m8 34 10-20 12 20 10-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="8" cy="34" r="3" fill="currentColor"/><circle cx="40" cy="20" r="3" fill="currentColor"/></svg>
        <h3>Здесь появится ваша миссия</h3><p>Нарисуйте область на карте, выберите борты и запустите расчёт.</p>
        <button className="download-btn" onClick={() => setPanelView('planning')}>Перейти к планированию</button>
      </div>}
      </div>
      <div className="panel-actions">
        <button className="submit-btn" onClick={onSubmit} disabled={isSending}
          aria-label={isSending ? 'Расчёт миссии' : undefined} aria-busy={isSending}>
          {isSending ? <span className="button-spinner" aria-hidden="true" /> :
            <span className="submit-label">{hasResult ? 'Пересчитать миссию' : 'Рассчитать миссию'}</span>}
        </button>
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

      </div>
    </aside>
  );
}
