import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import { GeomanControls } from "react-leaflet-geoman-v2";

import { airportIcon } from "../utils/icons";

import ZonesLayer from "./ZonesLayer";

import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

export default function MapView({ mapRef }) {
  const center = [55.751244, 37.618423];
  const zoom = 11;

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
          <TileLayer url='https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg' />
        </LayersControl.BaseLayer>
      </LayersControl>

      <ZonesLayer />

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