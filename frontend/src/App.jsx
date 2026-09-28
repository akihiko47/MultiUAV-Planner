import { useState, useRef } from 'react';
import './index.css';
import 'leaflet/dist/leaflet.css';
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';
import uavsData from './data/uavs.json';
import requestExample from './data/request_example.json';
import * as ops from './utils/operations';
import DisclaimerModal from './components/DisclaimerModal';
import RestrictionWarningModal from './components/RestrictionWarningModal';

const UAVS = uavsData.uavs;
const DEFAULT_UAV = UAVS[0].id;
const DEFAULT_GSD = '3';

function App() {
  const mapRef = useRef(null);

  const [selectedUavs, setSelectedUavs] = useState([DEFAULT_UAV]);
  const [uavCounts, setUavCounts] = useState({ [DEFAULT_UAV]: 2 });
  const [surveyType, setSurveyType] = useState('RGB');
  const [gsd, setGsd] = useState(DEFAULT_GSD);
  const [optimization, setOptimization] = useState('min_time');
  const [startDate, setStartDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [hiddenRoutes, setHiddenRoutes] = useState({});
  const [restrictionIds, setRestrictionIds] = useState([]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const settings = {
    selectedUavs, uavCounts, surveyType, gsd, optimization, startDate,
  };

  const onDownloadPayload = () => ops.handleDownload(mapRef, settings);
  const onDownloadResult = () => ops.downloadPlanResult(planResult);

  const onSubmit = async () => {
    setIsSending(true);
    try {
      const result = await ops.handleSubmit(mapRef, settings);
      if (result) {
        setPlanResult(result);
        setHiddenRoutes({});
        setRestrictionIds(result.restriction_warnings ?? []);
      }
    } finally {
      setIsSending(false);
    }
  };

  const onImport = (plan) => {
    const updates = ops.handleImport(mapRef, plan);

    if (updates.selectedUavs) setSelectedUavs(updates.selectedUavs);
    if (updates.uavCounts) setUavCounts(updates.uavCounts);
    if (updates.surveyType) setSurveyType(updates.surveyType);
    if (updates.gsd !== undefined) setGsd(String(updates.gsd));
    if (updates.optimization) setOptimization(updates.optimization);
    if (updates.startDate) setStartDate(updates.startDate);

    setPlanResult(null);
    setHiddenRoutes({});
  };

  const onLoadExample = () => {
    // Пример лежит в src/data/request_example.json и импортируется статически.
    // Используем тот же путь, что и импорт из файла.
    onImport(requestExample);
  };

  const onToggleRoute = (uavId) => {
    setHiddenRoutes((prev) => ({ ...prev, [uavId]: !prev[uavId] }));
  };

  return (
    <div className="app">
      <div className="map-area">
        <MapView
          mapRef={mapRef}
          assignments={planResult?.uav_assignments}
          hiddenRoutes={hiddenRoutes}
        />

        <button
          className="map-example-btn"
          onClick={onLoadExample}
          aria-label="Загрузить пример"
          title="Загрузить пример запроса на карту"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Загрузить пример</span>
        </button>

        <button
          className="panel-toggle-btn"
          onClick={() => setIsPanelOpen(true)}
          aria-label="Открыть настройки"
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

      {restrictionIds.length > 0 && (
      <RestrictionWarningModal
        ids={restrictionIds}
        onClose={() => setRestrictionIds([])}
      />
      )}

      <SidePanel
        uavs={UAVS}
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
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}

export default App;