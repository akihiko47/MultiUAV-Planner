import { useEffect } from "react";
import { MapContainer, TileLayer, LayersControl, useMap } from "react-leaflet";

import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

export default function GeomanTooltips() {

  const map = useMap();

  useEffect(() => {
    const TITLES = {
      // селекторы кнопок -> текст подсказки
      '.leaflet-pm-icon-marker':    'Добавить точку взлёта',
      '.leaflet-pm-icon-polygon':   'Нарисовать полигон зоны съёмки',
      '.leaflet-pm-icon-rectangle': 'Нарисовать прямоугольную зону съёмки',
      '.leaflet-pm-icon-edit':      'Редактировать',
      '.leaflet-pm-icon-drag':      'Перетаскивать',
      '.leaflet-pm-icon-cut':       'Сделать вырез',
      '.leaflet-pm-icon-delete':    'Удалить',
      '.leaflet-pm-icon-rotate':    'Вращать',
      '.leaflet-pm-icon-text':      'Добавить текст'
    };

    const applyTitles = () => {
      Object.entries(TITLES).forEach(([selector, text]) => {
        document.querySelectorAll(selector).forEach((btn) => {
          btn.setAttribute('title', text);
          btn.setAttribute('aria-label', text);
        });
      });
    };

    applyTitles();

    const observer = new MutationObserver(applyTitles);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [map]);

  return null;
}