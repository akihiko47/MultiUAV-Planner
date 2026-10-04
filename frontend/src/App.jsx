import { useState, useRef, useCallback } from 'react';
import './index.css';
import 'leaflet/dist/leaflet.css';
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';
import uavsData from './data/uavs.json';
import camerasData from './data/cameras.json';
import UavEditor from './components/UavEditor';
import { loadUavCatalog, saveUavCatalog, importUavCatalog, mergeCatalog } from './utils/uavCatalog';
import requestExample from './data/request_example.json';
import * as ops from './utils/operations';
import DisclaimerModal from './components/DisclaimerModal';
import RestrictionWarningModal from './components/RestrictionWarningModal';
import { loadUavNames, saveUavNames, uavNameKey } from './utils/uavNames';
import ThemeToggle from './components/ThemeToggle';
import GithubButton from './components/GithubButton';

const UAVS = uavsData.uavs;
const DEFAULT_UAV = UAVS[1].id;
const DEFAULT_GSD = '3';

function App() {
  const mapRef = useRef(null);
  const [catalog, setCatalog] = useState(() => loadUavCatalog({ uavs: UAVS, cameras: camerasData.cameras }));
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [editingUav, setEditingUav] = useState(null);
  const closeEditor = useCallback(() => setEditingUav(null), []);

  const [selectedUavs, setSelectedUavs] = useState([DEFAULT_UAV]);
  const [uavCounts, setUavCounts] = useState({ [DEFAULT_UAV]: 2 });
  const [surveyType, setSurveyType] = useState('RGB');
  const [gsd, setGsd] = useState(DEFAULT_GSD);
  const [optimization, setOptimization] = useState('min_time');
  const [startDate, setStartDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [hiddenRoutes, setHiddenRoutes] = useState({});
  const [uavNames, setUavNames] = useState(loadUavNames);
  const [restrictionIds, setRestrictionIds] = useState([]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelView, setPanelView] = useState('planning');
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const closeRestrictions = useCallback(() => setRestrictionIds([]), []);

  const settings = {
    selectedUavs, uavCounts, surveyType, gsd, optimization, startDate,
    uavCatalog: catalog.uavs, cameraCatalog: catalog.cameras,
  };

  const onDownloadPayload = () => ops.handleDownload(mapRef, settings);
  const onDownloadResult = () => ops.downloadPlanResult(planResult);

  const onSubmit = async () => {
    setIsSending(true);
    try {
      const result = await ops.handleSubmit(mapRef, settings);
      if (result && catalogRef.current === catalog) {
        setPlanResult(result);
        setPanelView('results');
        setHiddenRoutes({});
        setRestrictionIds(result.restriction_warnings ?? []);
      }
    } finally {
      setIsSending(false);
    }
  };

  const onImport = (plan) => {
    const importedCatalog = importUavCatalog(catalog, plan);
    saveUavCatalog(importedCatalog);
    const updates = ops.handleImport(mapRef, plan);
    setCatalog(importedCatalog);

    if (updates.selectedUavs) setSelectedUavs(updates.selectedUavs);
    if (updates.uavCounts) setUavCounts(updates.uavCounts);
    if (updates.surveyType) setSurveyType(updates.surveyType);
    if (updates.gsd !== undefined) setGsd(String(updates.gsd));
    if (updates.optimization) setOptimization(updates.optimization);
    if (updates.startDate) setStartDate(updates.startDate);

    setPlanResult(null);
    setPanelView('planning');
    setHiddenRoutes({});
  };

  const onLoadExample = () => {
    // Пример лежит в src/data/request_example.json и импортируется статически.
    // Используем тот же путь, что и импорт из файла.
    try { onImport(requestExample); }
    catch (error) { alert(error.message); }
  };

  const onSaveUav = (model) => {
    const updated = { ...catalog, uavs: mergeCatalog(catalog.uavs, [model]) };
    saveUavCatalog(updated);
    setCatalog(updated);
    if (editingUav.isNew) {
      setSelectedUavs(previous => [...previous, model.id]);
      setUavCounts(previous => ({ ...previous, [model.id]: 1 }));
    }
    setPlanResult(null);
    setHiddenRoutes({});
    setRestrictionIds([]);
  };

  const onToggleRoute = (uavId) => {
    setHiddenRoutes((prev) => ({ ...prev, [uavId]: !prev[uavId] }));
  };

  const onRenameUav = (uavId, typeId, name) => {
    const key = uavNameKey(uavId, typeId);
    const updated = { ...uavNames };
    const trimmed = name.trim().slice(0, 40);
    if (trimmed && trimmed !== uavId) updated[key] = trimmed;
    else delete updated[key];
    setUavNames(updated);
    saveUavNames(updated);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="m5 23 11-17 11 17-11-5-11 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M16 18v8" stroke="currentColor" strokeWidth="2"/></svg></span>
          <h1>MultiUAV<span> Planner</span></h1>
        </div>
        <div className={`workspace-status${planResult ? ' is-ready' : ''}`} role="status">
          <i />{isSending ? 'Расчёт миссии…' : planResult ? 'Миссия рассчитана' : 'Новая миссия'}
        </div>
        <div className="header-actions"><ThemeToggle /><GithubButton /></div>
      </header>
      <div className="map-area">
        <MapView
          uavs={catalog.uavs}
          mapRef={mapRef}
          assignments={planResult?.uav_assignments}
          hiddenRoutes={hiddenRoutes}
          uavNames={uavNames}
          onLoadExample={onLoadExample}
        />

        <button
          className="panel-toggle-btn"
          onClick={() => setIsPanelOpen(true)}
          aria-label="Открыть настройки"
          aria-expanded={isPanelOpen}
          aria-controls="mission-side-panel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      <div
        className={`panel-overlay ${isPanelOpen ? 'open' : ''}`}
        onClick={() => setIsPanelOpen(false)}
      />
      <DisclaimerModal />
      {editingUav && <UavEditor model={editingUav.model} isNew={editingUav.isNew}
        cameras={catalog.cameras} onSave={onSaveUav} onClose={closeEditor} />}

      {restrictionIds.length > 0 && (
      <RestrictionWarningModal
        ids={restrictionIds}
        onClose={closeRestrictions}
      />
      )}

      <SidePanel
        panelView={panelView}
        setPanelView={setPanelView}
        uavs={catalog.uavs}
        onEditUav={model => setEditingUav({ model, isNew: false })}
        onAddUav={() => setEditingUav({ model: { ...UAVS[1], id: `custom_${crypto.randomUUID()}` }, isNew: true })}
        selectedUavs={selectedUavs}
        setSelectedUavs={setSelectedUavs}
        uavCounts={uavCounts}
        setUavCounts={setUavCounts}
        surveyType={surveyType}
        setSurveyType={setSurveyType}
        gsd={gsd}
        setGsd={setGsd}
        optimization={optimization}
        setOptimization={setOptimization}
        startDate={startDate}
        setStartDate={setStartDate}
        onSubmit={onSubmit}
        onDownloadResult={onDownloadResult}
        onDownloadPayload={onDownloadPayload}
        onImport={onImport}
        isSending={isSending}
        assignments={planResult?.uav_assignments}
        hiddenRoutes={hiddenRoutes}
        planResult={planResult}
        onToggleRoute={onToggleRoute}
        uavNames={uavNames}
        onRenameUav={onRenameUav}
        isOpen={isPanelOpen}
        onClose={closePanel}
      />
    </div>
  );
}

export default App;
