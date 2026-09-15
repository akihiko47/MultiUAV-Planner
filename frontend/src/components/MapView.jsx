import { MapContainer, TileLayer } from "react-leaflet"

export default function MapView() {

  const center = [55.751244, 37.618423];
  const zoom = 13;

  return (
    <MapContainer center={center} zoom={zoom} zoomControl={false}>
        <TileLayer
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
    </MapContainer>
  );
}