export default function UavSelector({
  uavs,
  selected,
  onChange,
  uavCounts = {},
  onCountsChange = () => {},
  onEdit,
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
    const n = Math.floor(Math.max(1, Number(uavCounts[id]) || 1));
    onCountsChange({ ...uavCounts, [id]: n });
  };

  return (
    <div className="uav-selector">
      {uavs.map((uav) => {
        const isChecked = selected.includes(uav.id);

        return (
          <div key={uav.id} className={`uav-item${isChecked ? ' is-selected' : ''}`}>
            <label className="uav-check">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(uav.id)}
              />
              <span className="uav-model"><strong>{uav.name}</strong></span>
            </label>

            {isChecked && (
              <input
                className="uav-count"
                type="number"
                min="1"
                step="1"
                aria-label={`Количество бортов ${uav.name}`}
                title="Количество бортов"
                value={uavCounts[uav.id] ?? 1}
                onChange={(e) => setCount(uav.id, e.target.value)}
                onBlur={() => normalizeCount(uav.id)}
              />
            )}
            <button type="button" className="uav-edit-btn" onClick={() => onEdit(uav)}
              aria-label={`Изменить параметры ${uav.name}`} title="Изменить параметры">✎</button>
          </div>
        );
      })}
    </div>
  );
}
