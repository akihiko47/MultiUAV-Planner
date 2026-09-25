const API_URL = import.meta.env.VITE_API_URL || '/api';

async function downloadFromEndpoint(path, planResult, filename) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(planResult),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadMissionPlannerZip(planResult) {
  await downloadFromEndpoint(
    '/v1/export/mission-planner',
    planResult,
    'mission_planner.zip',
  );
}

export async function downloadGeoscanKml(planResult) {
  await downloadFromEndpoint(
    '/v1/export/geoscan-kml',
    planResult,
    'geoscan_plan.kml',
  );
}