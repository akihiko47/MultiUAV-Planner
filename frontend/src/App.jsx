import { useState } from 'react';

import './index.css';
import 'leaflet/dist/leaflet.css'
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';

function App() {
  const [selectedUavs, setSelectedUavs] = useState([]);
  const [surveyType, setSurveyType] = useState('RGB');
  const [optimization, setOptimization] = useState('min_time');

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
        selectedUavs={selectedUavs}
        setSelectedUavs={setSelectedUavs}
        surveyType={surveyType}
        setSurveyType={setSurveyType}
        optimization={optimization}
        setOptimization={setOptimization}
      />
    </div>
  );
}

export default App;