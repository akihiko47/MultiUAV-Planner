import { useEffect } from "react";
import { MapContainer, TileLayer, LayersControl, useMap } from "react-leaflet";
import { GeomanControls } from "react-leaflet-geoman-v2";
import L from "leaflet";

import { airportIcon } from "../utils/icons";

import ZonesLayer from "./ZonesLayer";
import RoutesLayer from "./RoutesLayer";
import GeomanTooltips from "./GeomanTooltips";
import MissionPlayer from "./MissionPlayer";
import MapGuide from "./MapGuide";

import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';


function SinglePolygonControl() {
  const map = useMap();

  useEffect(() => {
    const handleCreate = (e) => {
      if (!(e.layer instanceof L.Polygon)) {
        return;
      }

      const toRemove = [];
      map.eachLayer((layer) => {
        if (
          layer instanceof L.Polygon &&
          layer.options?.isUserArea &&
          layer !== e.layer
        ) {
          toRemove.push(layer);
        }
      });
      toRemove.forEach((l) => map.removeLayer(l));

      e.layer.options.isUserArea = true;
    };

    map.on("pm:create", handleCreate);
    return () => map.off("pm:create", handleCreate);
  }, [map]);

  return null;
}


export default function MapView({ mapRef, assignments, hiddenRoutes, uavNames, onLoadExample }) {
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

      <SinglePolygonControl />
      <GeomanTooltips />

      <ZonesLayer />
      <RoutesLayer assignments={assignments} hiddenRoutes={hiddenRoutes} />
      <MissionPlayer assignments={assignments} hiddenRoutes={hiddenRoutes}
        uavNames={uavNames} onLoadExample={onLoadExample} />
      <MapGuide assignments={assignments} />

      <GeomanControls
        options={{
          drawCircle: false,
          drawCircleMarker: false,
          drawPolyline: false,
          drawText: false,
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
