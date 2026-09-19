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
      </div>

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
      />
    </div>
  );
}

export default App;