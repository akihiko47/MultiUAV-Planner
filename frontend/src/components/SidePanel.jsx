import ThemeToggle from './ThemeToggle';
import GithubButton from './GithubButton';
import UavSelector from './UavSelector';


export default function SidePanel({
  uavs,
  selectedUavs,
  setSelectedUavs,
  uavCounts,
  setUavCounts,
  surveyType,
  setSurveyType,
  optimization,
  setOptimization,
  startDate,
  setStartDate,
  onSubmit,
}) {
  return (
    <aside className="side-panel">
      <div className="panel-header">
        <ThemeToggle />
        <GithubButton />
      </div>

      <UavSelector
        uavs={uavs}
        selected={selectedUavs}
        onChange={setSelectedUavs}
        uavCounts={uavCounts}
        onCountsChange={setUavCounts}
      />

      <div className="form-field">
        <h3>Дата и время начала</h3>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="form-field">
        <h3>Тип съёмки</h3>
        <select value={surveyType} onChange={(e) => setSurveyType(e.target.value)}>
          <option value="RGB">RGB</option>
          <option value="LiDAR">Лидар</option>
          <option value="multispectral">Мультиспектральная</option>
          <option value="IR">IR</option>
          <option value="geophysical">Геофизическая</option>
        </select>
      </div>

      <div className="form-field">
        <h3>Оптимизировать по</h3>
        <select value={optimization} onChange={(e) => setOptimization(e.target.value)}>
          <option value="min_time">Минимальному времени</option>
          <option value="min_flight_distance">Суммарному налёту</option>
        </select>
      </div>

      <button className="submit-btn" onClick={onSubmit}>
        Запустить расчёт
      </button>
    </aside>
  );
}