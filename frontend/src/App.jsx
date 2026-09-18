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

  // Собираем все настройки в один объект — чтобы не передавать их по одному
  const settings = {
    selectedUavs, uavCounts, surveyType, optimization, startDate,
  };

  // Обёртки, которые связывают функции из operations.js с состоянием App
  const onDownload = () => ops.handleDownload(mapRef, settings);

  const onSubmit = async () => {
    setIsSending(true);
    try {
      await ops.handleSubmit(mapRef, settings);
    } finally {
      setIsSending(false);
    }
  };

  const onImport = (plan) => {
    const updates = ops.handleImport(mapRef, plan);

    // Применяем обновления формы
    if (updates.selectedUavs) setSelectedUavs(updates.selectedUavs);
    if (updates.uavCounts) setUavCounts(updates.uavCounts);
    if (updates.surveyType) setSurveyType(updates.surveyType);
    if (updates.optimization) setOptimization(updates.optimization);
    if (updates.startDate) setStartDate(updates.startDate);
  };

  return (
    <div className="app">
      <div className="map-area">
        <MapView mapRef={mapRef} />
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
      />
    </div>
  );
}

export default App;