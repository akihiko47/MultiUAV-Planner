import uavsData from "../data/uavs.json";

export default function UavSelector({ selected, onChange }) {
  const toggle = (name) => {
    if (selected.includes(name))
    {
      onChange(selected.filter((x) => x !== name));
    } 
    else 
    {
      onChange([...selected, name]);
    }
  };

  return (
    <div className="uav-selector">
      <h3>БВС для полёта</h3>
      {uavsData.uavs.map((uav) => (
        <label key={uav.name} className="uav-item">
          <input
            type="checkbox"
            checked={selected.includes(uav.name)}
            onChange={() => toggle(uav.name)}
          />
          <span>{uav.name}</span>
        </label>
      ))}
    </div>
  );
}