const ROUTE_COLORS = ['#2479bd', '#7d59b7', '#d68a24', '#16917d', '#ce668d', '#57708d', '#b65e31', '#729731'];

export function getRouteColor(index) {
  if (index < ROUTE_COLORS.length) return ROUTE_COLORS[Math.max(0, index)];
  return `hsl(${(index * 137.508) % 360}, 60%, 46%)`;
}
