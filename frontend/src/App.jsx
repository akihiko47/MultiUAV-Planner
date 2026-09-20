import { useState, useRef } from 'react';
import './index.css';
import 'leaflet/dist/leaflet.css';
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';
import uavsData from './data/uavs.json';
import * as ops from './utils/operations';

const UAVS = uavsData.uavs;
const DEFAULT_UAV = UAVS[0].id;

function App() {
  const mapRef = useRef(null);

  const [selectedUavs, setSelectedUavs] = useState([DEFAULT_UAV]);
  const [uavCounts, setUavCounts] = useState({ [DEFAULT_UAV]: 2 });
  const [surveyType, setSurveyType] = useState('RGB');
  const [optimization, setOptimization] = useState('min_time');
  const [startDate, setStartDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [hiddenRoutes, setHiddenRoutes] = useState({});

  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const settings = {
    selectedUavs, uavCounts, surveyType, optimization, startDate,
  };

  const onDownload = () => ops.handleDownload(mapRef, settings);

  const onSubmit = async () => {
    setIsSending(true);
    try {
      const result = await ops.handleSubmit(mapRef, settings);
      if (result) {
        setPlanResult(result);
        setHiddenRoutes({});
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
    if (updates.optimization) setOptimization(updates.optimization);
    if (updates.startDate) setStartDate(updates.startDate);

    setPlanResult(null);
    setHiddenRoutes({});
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

      <SidePanel
        uavs={UAVS}
        selectedUavs={selectedUavs}
        setSelectedUavs={setSelectedUavs}
        uavCounts={uavCounts}
        setUavCounts={setUavCounts}
        surveyType={surveyType}
        setSurveyType={setSurveyType}
        optimization={optimization}
        setOptimization={setOptimization}
        startDate={startDate}
        setStartDate={setStartDate}
        onSubmit={onSubmit}
        onDownload={onDownload}
        onImport={onImport}
        isSending={isSending}
        assignments={planResult?.uav_assignments}
        hiddenRoutes={hiddenRoutes}
        onToggleRoute={onToggleRoute}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}

export default App;