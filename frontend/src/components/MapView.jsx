import { MapContainer, TileLayer, Marker, Polygon, Popup, Polyline, LayersControl } from "react-leaflet"
import { Icon } from "leaflet"
import { GeomanControls } from "react-leaflet-geoman-v2"

import SaveControl from "./SaveControl"
import ZonesLayer from "./ZonesLayer"

import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'  // для редактирования полигонов

import pinImg from "../img/pin.png"
import airportImg from "../img/airport.png"
import MouseCoordinates from "./MouseCoordinages"

function LocationMarker() {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        Координаты: <br />
        {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
      </Popup>
    </Marker>
  );
}


export default function MapView() {

  const center = [55.751244, 37.618423];
  const zoom = 13;

  const pinIcon = new Icon({
    iconUrl: pinImg,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  })

  const airportIcon = new Icon({
    iconUrl: airportImg,
    iconSize: [38, 38],
    iconAnchor: [19, 35],
  })

  return (
    <MapContainer center={center} zoom={zoom} zoomControl={false}>

      <LayersControl position="topleft">
        <LayersControl.BaseLayer checked={true} name="Схема">
          <TileLayer
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Спутник">
          <TileLayer
            url='https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg'
          />
        </LayersControl.BaseLayer>
      </LayersControl>
        
      <SaveControl label="Сохранить метки"/>

      <Marker position={center} icon={airportIcon}>
        <Popup>
          <p>Airport 1</p>
        </Popup>
      </Marker>

      <Polygon 
        positions={[[55.751244, 37.618423], [55.751244, 37.628423], [55.741244, 37.618423]]}
      />

      <ZonesLayer/>
      {/* <MouseCoordinates/> */}
     

      <GeomanControls
        options={{
          drawCircle: false,
          drawCircleMarker: false,
          drawPolyline: false,
          cutPolygon: false,
        }}
        globalOptions={{
          markerStyle: {
            icon: airportIcon,
            text: "asdf"
          }
        }}
      />

    </MapContainer>
  );
}