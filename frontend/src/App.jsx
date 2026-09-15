import { useState, useEffect } from 'react';

import './index.css';
import 'leaflet/dist/leaflet.css'
import MapView from './components/MapView';
import SidePanel from './components/SidePanel';

function App() {
  return (
    <div className="app">
      <div className="map-area">
        <MapView />
      </div>
      <SidePanel />
    </div>
  );
}

export default App;