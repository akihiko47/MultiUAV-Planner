import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function fitRoutes(map, assignments) {
  const positions = assignments?.flatMap((assignment) => assignment.route.coordinates.map(([lon, lat]) => [lat, lon]));
  if (!positions?.length) return;
  const height = map.getContainer().querySelector('.map-bottom-dock')?.offsetHeight || 0;
  map.fitBounds(L.latLngBounds(positions), {
    paddingTopLeft: [64, 120],
    paddingBottomRight: [40, Math.min(height + 28, map.getSize().y * 0.45)],
    maxZoom: 16,
  });
}

export default function MapGuide({ assignments }) {
  const map = useMap();
  const guideRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [preparation, setPreparation] = useState({ area: false, starts: 0 });
  const hasResult = assignments?.length > 0;
  useEffect(() => {
    let frame;
    const update = () => {
      frame = undefined;
      let area = false;
      let starts = 0;
      map.eachLayer((layer) => {
        // Geoman adds preview polygons and vertex/cursor markers during drawing.
        if (layer.options?.noSave || layer._pmTempLayer) return;
        if (layer instanceof L.Polygon) area = true;
        else if (layer instanceof L.Marker) starts++;
      });
      setPreparation((previous) => previous.area === area && previous.starts === starts
        ? previous : { area, starts });
    };
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };
    update();
    // Layer events cover imports as well as manual drawing and deletion.
    const events = 'layeradd layerremove pm:create pm:remove pm:edit pm:update';
    map.on(events, schedule);
    return () => { map.off(events, schedule); cancelAnimationFrame(frame); };
  }, [map]);
  useEffect(() => {
    if (assignments?.length) fitRoutes(map, assignments);
  }, [map, assignments]);
  useEffect(() => {
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize());
    });
    observer.observe(map.getContainer());
    const guide = guideRef.current;
    L.DomEvent.disableClickPropagation(guide);
    L.DomEvent.disableScrollPropagation(guide);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); L.DomEvent.off(guide); };
  }, [map]);
  const step = !preparation.area ? 1 : !preparation.starts ? 2 : 3;
  const title = hasResult ? 'Миссия рассчитана' : step === 1 ? 'Обозначьте область работ'
    : step === 2 ? 'Добавьте точку взлёта' : 'Можно рассчитывать миссию';
  const description = hasResult ? 'Цвета маршрутов соответствуют бортам во вкладке «Результат».'
    : step === 1 ? 'Нарисуйте полигон или прямоугольник инструментами слева.'
      : step === 2 ? 'Укажите хотя бы одну точку инструментом «Добавить точку взлёта» слева.'
        : 'Выберите модели БВС и параметры съёмки в панели планирования.';
  return <div className={`map-guide${collapsed ? ' is-collapsed' : ''}`} ref={guideRef}>
    <div className="map-guide-head">
      <strong aria-live="polite" title={title}>{title}</strong>
      <button type="button" className="guide-toggle" aria-label={collapsed ? 'Развернуть подсказку' : 'Свернуть подсказку'}
        aria-expanded={!collapsed} aria-controls="map-guide-content" onClick={() => setCollapsed((value) => !value)}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d={collapsed ? 'm6 8 4 4 4-4' : 'm6 12 4-4 4 4'} />
        </svg>
      </button>
    </div>
    {!collapsed && <div id="map-guide-content">
    {!hasResult && <span className="guide-step">Подготовка · шаг {step} из 3</span>}
    <p>{description}</p>
    {!hasResult && <div className="guide-checks">
      <span className={preparation.area ? 'is-complete' : ''}>{preparation.area ? '✓' : '○'} Зона съёмки</span>
      <span className={preparation.starts ? 'is-complete' : ''}>{preparation.starts ? '✓' : '○'} Точка взлёта</span>
    </div>}
    {hasResult && <button type="button" className="map-fit-btn" onClick={() => fitRoutes(map, assignments)}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/><circle cx="10" cy="10" r="3"/></svg>
      Показать все маршруты
    </button>}
    <div className="map-zone-legend"><span><i className="zone-no-fly" />Запрет полётов</span><span><i className="zone-restriction" />Ограничения</span></div>
    </div>}
  </div>;
}
