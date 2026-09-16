import { Circle, Polygon } from 'react-leaflet';
import zonesData from '../data/no_fly_zones.json';

export default function ZonesLayer() {
  return (
    <>
      {zonesData.zones.map((zone, index) => {
        if (zone.type === 'circle') {
          return (
            <Circle
              key={index}
              center={zone.center}
              pmIgnore={true}
              radius={zone.radius_km * 1000} /* км → метры */
              pathOptions={{
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.2,
              }}
            />
          );
        }

        if (zone.type === 'polygon') {
          return (
            <Polygon
              key={index}
              positions={zone.coordinates}
              pmIgnore={true}
              pathOptions={{
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.2,
              }}
            />
          );
        }

        return null;
      })}
    </>
  );
}