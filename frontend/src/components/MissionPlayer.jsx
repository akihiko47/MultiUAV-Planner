import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { buildMission, formatElapsed, positionAtTime } from '../utils/missionPlayback';
import { getRouteColor } from '../utils/routeColors';
import { getUavName, isFixedWing } from '../utils/uavNames';
import uavsData from '../data/uavs.json';
import './MissionPlayer.css';

const clock = (time) => new Date(time).toLocaleTimeString('ru-RU');
const eventTime = (time) => new Date(time).toLocaleString('ru-RU');

function droneIcon(color, fixedWing) {
  const symbol = fixedWing
    ? '<path fill="white" d="M17 7h2l1 8 10 6v3l-10-3v6l4 3v2l-6-2-6 2v-2l4-3v-6L6 24v-3l10-6z"/>'
    : `<g stroke="white" stroke-width="2" stroke-linecap="round"><path d="m11 11 14 14m0-14L11 25"/><rect x="14" y="14" width="8" height="8" rx="2" fill="${color}"/><circle cx="10" cy="10" r="4"/><circle cx="26" cy="10" r="4"/><circle cx="10" cy="26" r="4"/><circle cx="26" cy="26" r="4"/></g>`;
  return L.divIcon({
    className: 'mission-drone', iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2"/>${symbol}</svg>`,
  });
}

function MissionSession({ mission, hiddenRoutes, uavNames }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const elapsedRef = useRef(0);
  const icons = useMemo(() => new Map(mission.groups.map((group) => [group.uavId,
    droneIcon(getRouteColor(group.colorIndex, mission.colorCount),
      isFixedWing(uavsData.uavs.find((model) => model.id === group.typeId)))])), [mission]);

  useEffect(() => {
    if (!playing) return;
    let frame;
    let previous = performance.now();
    const tick = (now) => {
      elapsedRef.current = Math.min(mission.duration, elapsedRef.current + (now - previous) / 1000 * speed);
      previous = now;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= mission.duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, mission.duration]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const seek = (seconds) => {
    elapsedRef.current = Math.max(0, Math.min(mission.duration, seconds));
    setElapsed(elapsedRef.current);
    if (elapsedRef.current >= mission.duration) setPlaying(false);
  };
  const togglePlay = () => {
    if (elapsedRef.current >= mission.duration) seek(0);
    setPlaying((value) => !value);
  };
  const time = mission.start + elapsed * 1000;
  const percent = (timestamp) => (timestamp - mission.start) / (mission.end - mission.start) * 100;
  const progress = elapsed / mission.duration * 100;

  return <>
    {!collapsed && mission.groups.map((group) => {
      if (hiddenRoutes[group.uavId]) return null;
      const flight = group.flights.findLast((item) => time >= item.start && time <= item.end);
      const position = flight && positionAtTime(flight, time);
      if (!position) return null;
      return <Marker key={group.uavId} position={position} icon={icons.get(group.uavId)}
        pmIgnore noSave keyboard={false} zIndexOffset={1000}>
        <Tooltip direction="top" offset={[0, -18]}>{getUavName(uavNames, group.uavId, group.typeId)} · {clock(time)}</Tooltip>
      </Marker>;
    })}
    <button className="mission-collapse" type="button" aria-expanded={!collapsed}
      aria-controls="mission-timeline"
      onClick={() => { setPlaying(false); setCollapsed((value) => !value); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={collapsed ? 'm6 9 6 6 6-6' : 'm6 15 6-6 6 6'} />
      </svg>
      <span>{collapsed ? 'Развернуть плеер миссии' : 'Свернуть плеер миссии'}</span>
    </button>
    {!collapsed && <section id="mission-timeline" className="mission-player"
      aria-label="Плеер миссии" onKeyDown={(event) => event.stopPropagation()}>
      <div className="mission-toolbar">
        <strong>Плеер миссии</strong>
        <div className="mission-controls">
          <button className="mission-play" type="button" onClick={togglePlay}
            aria-label={playing ? 'Пауза' : 'Воспроизвести'}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">{playing
              ? <path d="M5 4h3v12H5zm7 0h3v12h-3z" /> : <path d="m6 3 10 7-10 7z" />}</svg>
          </button>
          <button className="mission-reset" type="button" onClick={() => { setPlaying(false); seek(0); }}
            aria-label="В начало миссии" title="В начало миссии">↤</button>
          <label className="mission-speed">
            <select aria-label="Скорость воспроизведения" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {[0.5, 1, 2, 5, 10, 30, 60, 120].map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
        </div>
        <span className="mission-time">{formatElapsed(elapsed)} <span>/ {formatElapsed(mission.duration)}</span></span>
      </div>
      {!collapsed && <div className="mission-body">
        <div className="mission-caption"><span>{eventTime(time)}</span></div>
        <div className="mission-ruler">
          <span>Борт / вылеты</span>
          <div className="mission-ruler-track">
            <div className="mission-ticks">{[0, 0.25, 0.5, 0.75, 1].map((fraction) =>
              <span key={fraction} style={{ left: `${fraction * 100}%` }}>{formatElapsed(mission.duration * fraction)}</span>)}</div>
            <input type="range" min="0" max={mission.duration} step="0.01" value={elapsed}
              style={{ '--progress': `${progress}%` }}
              aria-label="Время миссии" aria-valuetext={`${formatElapsed(elapsed)} из ${formatElapsed(mission.duration)}`}
              onChange={(event) => seek(Number(event.target.value))} />
          </div>
        </div>
        <div className="mission-lanes">
          {mission.groups.map((group) => {
            const color = getRouteColor(group.colorIndex, mission.colorCount);
            const name = getUavName(uavNames, group.uavId, group.typeId);
            return <div className={`mission-lane${hiddenRoutes[group.uavId] ? ' is-hidden' : ''}`} key={group.uavId}>
              <span className="mission-uav" title={name}><i style={{ background: color }} /><span className="mission-uav-name">{name}</span></span>
              <div className="mission-track" onClick={(event) => {
                if (event.target.closest('button')) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                seek((event.clientX - bounds.left) / bounds.width * mission.duration);
              }}>
                {group.flights.map((flight, index) => <div key={flight.id} className="mission-flight"
                  style={{ left: `${percent(flight.start)}%`, width: `${percent(flight.end) - percent(flight.start)}%`, '--flight-color': color }}>
                  <button type="button" className="mission-event takeoff" onClick={() => seek((flight.start - mission.start) / 1000)}
                    aria-label={`${name}: взлёт, вылет ${index + 1}, ${eventTime(flight.start)}`}
                    title={`Взлёт ${name} · вылет ${index + 1} · ${eventTime(flight.start)}`}>↑</button>
                  <button type="button" className="mission-event landing" onClick={() => seek((flight.end - mission.start) / 1000)}
                    aria-label={`${name}: посадка, вылет ${index + 1}, ${eventTime(flight.end)}`}
                    title={`Посадка ${name} · вылет ${index + 1} · ${eventTime(flight.end)}`}>↓</button>
                </div>)}
                <div className="mission-playhead" style={{ left: `${progress}%` }} />
              </div>
            </div>;
          })}
        </div>
        <div className="mission-endpoints"><span>{clock(mission.start)}</span><span>{clock(mission.end)}</span></div>
      </div>}
    </section>}
  </>;
}

export default function MissionPlayer({ assignments, hiddenRoutes, uavNames, onLoadExample }) {
  const dockRef = useRef(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  const mission = useMemo(() => buildMission(assignments), [assignments]);
  // A new calculation remounts the session, resetting time and playback state.
  const [version, setVersion] = useState({ assignments, id: 0 });
  if (version.assignments !== assignments) setVersion({ assignments, id: version.id + 1 });
  useEffect(() => {
    const dock = dockRef.current;
    L.DomEvent.disableClickPropagation(dock);
    L.DomEvent.disableScrollPropagation(dock);
    L.DomEvent.on(dock, 'keydown', L.DomEvent.stopPropagation);
    return () => { L.DomEvent.off(dock); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 769px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <div ref={dockRef} className="map-bottom-dock">
    <button className="map-example-btn" type="button" onClick={onLoadExample}
      aria-label="Загрузить пример" title="Загрузить пример запроса на карту">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>Загрузить пример</span>
    </button>
    {desktop && mission && <MissionSession key={version.id} mission={mission}
      hiddenRoutes={hiddenRoutes} uavNames={uavNames} />}
  </div>;
}
