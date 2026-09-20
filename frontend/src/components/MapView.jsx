import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import { GeomanControls } from "react-leaflet-geoman-v2";

import { airportIcon } from "../utils/icons";

import ZonesLayer from "./ZonesLayer";
import RoutesLayer from "./RoutesLayer";

import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

export default function MapView({ mapRef, assignments, hiddenRoutes }) {
  const center = [55.751244, 37.618423];
  const zoom = 10;

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      zoomControl={false}
    >
      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked name="Схема">
          <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Спутник">
          <TileLayer url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ZonesLayer />
      <RoutesLayer assignments={assignments} hiddenRoutes={hiddenRoutes} />

      <GeomanControls
        options={{
          drawCircle: false,
          drawCircleMarker: false,
          drawPolyline: false,
        }}
        globalOptions={{
          markerStyle: {
            icon: airportIcon,
          }
        }}
      />
    </MapContainer>
  );
}