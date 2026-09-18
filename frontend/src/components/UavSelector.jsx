export default function UavSelector({
  uavs,
  selected,
  onChange,
  uavCounts = {},
  onCountsChange = () => {},
}) {
  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
      if (!uavCounts[id]) {
        onCountsChange({ ...uavCounts, [id]: 1 });
      }
    }
  };

  const setCount = (id, value) => {
    onCountsChange({ ...uavCounts, [id]: value });
  };

  const normalizeCount = (id) => {
    const n = Math.max(1, Number(uavCounts[id]) || 1);
    onCountsChange({ ...uavCounts, [id]: n });
  };

  return (
    <div className="uav-selector">
      <h3>Типы БВС</h3>

      {uavs.map((uav) => {
        const isChecked = selected.includes(uav.id);

        return (
          <div key={uav.id} className="uav-item">
            <label className="uav-check">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(uav.id)}
              />
              <span>{uav.name}</span>
            </label>

            {isChecked && (
              <input
                className="uav-count"
                type="number"
                min="1"
                value={uavCounts[uav.id] ?? 1}
                onChange={(e) => setCount(uav.id, e.target.value)}
                onBlur={() => normalizeCount(uav.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}