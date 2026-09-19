export function getRouteColor(index, total) {
  if (total <= 1) return 'hsl(48, 100%, 50%)'; // золотой

  const t = index / (total - 1);   // 0 → 1
  const hue = 35 + t * 20;         // оранжевый → жёлтый
  const lightness = 45 + t * 20;   // тёмный → светлый

  return `hsl(${hue}, 100%, ${lightness}%)`;
}