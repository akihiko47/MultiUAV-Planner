import { airportIcon } from './icons';
import {
  collectMapData,
  buildPlan,
  sendPlan,
  downloadPlan,
  applyPlanToMap,
} from './plan';

export function isoToLocalInput(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validatePlan(plan) {
  if (!plan) return 'Карта ещё не загружена';
  if (!plan.survey_area) return 'Добавьте зону съёмки';
  if (!plan.start_points || plan.start_points.length === 0) {
    return 'Добавьте точки взлёта';
  }
  return null;
}

// Собираем payload
export function makePayload(mapRef, settings) {
  if (!mapRef.current) return null;
  const mapData = collectMapData(mapRef.current);
  return buildPlan({ mapData, ...settings });
}

// Скачивание
export function handleDownload(mapRef, settings) {
  const plan = makePayload(mapRef, settings);
  const error = validatePlan(plan);
  if (error) {
    alert(error);
    return;
  }
  downloadPlan(plan);
  console.log('Сохранено:', plan);
}

// Отправка
export async function handleSubmit(mapRef, settings) {
  const plan = makePayload(mapRef, settings);
  const error = validatePlan(plan);
  if (error) {
    alert(error);
    return;
  }

  try {
    console.log('Отправляем:', plan);
    const result = await sendPlan(plan);
    console.log('Ответ сервера:', result);
    alert('План отправлен');
    return result;
  } catch (err) {
    console.error(err);
    alert('Ошибка отправки: ' + err.message);
  }
}

// Импорт: возвращает объект для обновления формы.
export function handleImport(mapRef, plan) {
  if (mapRef.current) {
    applyPlanToMap(mapRef.current, plan, { markerIcon: airportIcon });
  } else {
    console.warn('Карта ещё не готова');
  }

  // Готовим данные для setState в App
  const formUpdates = {};
  if (Array.isArray(plan.uav_types)) {
    formUpdates.selectedUavs = plan.uav_types.map((t) => t.id);
  }
  if (Array.isArray(plan.uavs)) {
    const counts = {};
    plan.uavs.forEach((u) => {
      counts[u.type_id] = (counts[u.type_id] || 0) + 1;
    });
    formUpdates.uavCounts = counts;
  }
  if (plan.survey_type) formUpdates.surveyType = plan.survey_type;
  if (plan.optimization_criteria) formUpdates.optimization = plan.optimization_criteria;
  if (plan.operation_start_time) {
    formUpdates.startDate = isoToLocalInput(plan.operation_start_time);
  }

  console.log('Импортировано:', plan);
  return formUpdates;
}