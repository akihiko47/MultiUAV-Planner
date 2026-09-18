import { useState } from 'react';
import './index.css';
import 'leaflet/dist/leaflet.css';
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';
import uavsData from './data/uavs.json';

const UAVS = uavsData.uavs;
const DEFAULT_UAV = UAVS[0].id;

function App() {
  const [selectedUavs, setSelectedUavs] = useState([DEFAULT_UAV]);
  const [uavCounts, setUavCounts] = useState({ [DEFAULT_UAV]: 2 });
  const [surveyType, setSurveyType] = useState('RGB');
  const [optimization, setOptimization] = useState('min_time');
  const [startDate, setStartDate] = useState('');

  const handleSubmit = () => {
    const uavs = selectedUavs.map((id) => {
      const uav = UAVS.find((u) => u.id === id);
      return {
        id,
        name: uav?.name,
        count: Math.max(1, Number(uavCounts[id]) || 1),
      };
    });

    const payload = {
      uavs,
      survey_type: surveyType,
      optimization,
      start_date: startDate ? new Date(startDate).toISOString() : null,
    };

    console.log('Отправляем:', payload);
  };

  return (
    <div className="app">
      <div className="map-area">
        <MapView
          selectedUavs={selectedUavs}
          surveyType={surveyType}
          optimization={optimization}
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
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default App;