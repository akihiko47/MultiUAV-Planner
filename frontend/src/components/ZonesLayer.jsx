import { Circle, Polygon } from 'react-leaflet';
import noFlyZones from '../data/no_fly_zones.json';
import restrictionZones from '../data/restriction_zones.json';

const NO_FLY_STYLE = {
  color: 'red',
  fillColor: 'red',
  fillOpacity: 0.2,
};

const RESTRICTION_STYLE = {
  color: 'orange',
  fillColor: 'orange',
  fillOpacity: 0.1,
  weight: 1,
  opacity: 0.7,
};

function renderZones(zones, pathOptions) {
  return zones.map((zone, index) => {
    const key = zone.id ?? `zone-${index}`;

    if (zone.type === 'circle') {
      return (
        <Circle
          key={key}
          center={zone.center}
          pmIgnore={true}
          noSave={true}
          radius={zone.radius_km * 1000} /* км → метры */
          pathOptions={pathOptions}
        />
      );
    }

    if (zone.type === 'polygon') {
      return (
        <Polygon
          key={key}
          positions={zone.coordinates}
          pmIgnore={true}
          noSave={true}
          pathOptions={pathOptions}
        />
      );
    }

    return null;
  });
}

export default function ZonesLayer() {
  return (
    <>
      {renderZones(noFlyZones.zones, NO_FLY_STYLE)}
      {renderZones(restrictionZones.zones, RESTRICTION_STYLE)}
    </>
  );
}