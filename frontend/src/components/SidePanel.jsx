import ThemeToggle from "./ThemeToggle";
import GithubButton from './GithubButton';
import UavSelector from "./UavSelector";

export default function SidePanel({
  selectedUavs,
  setSelectedUavs,
  surveyType,
  setSurveyType,
  optimization,
  setOptimization
}) {
  return (
    <aside className="side-panel">
      <div className="panel-header">
        <ThemeToggle />
        <GithubButton />
      </div>

      <UavSelector
        selected={selectedUavs}
        onChange={setSelectedUavs}
      />

      <div className="survey-type">
        <h3>Тип съёмки</h3>
        <select
          value={surveyType}
          onChange={(e) => setSurveyType(e.target.value)}
        >
          <option value="RGB">RGB</option>
          <option value="LiDAR">Лидар</option>
          <option value="multispectral">Мультиспектральная</option>
          <option value="IR">IR</option>
          <option value="geophysical">Геофизическая</option>
        </select>
      </div>

      <div className="survey-type">
        <h3>Оптимизировать по</h3>
        <select
          value={optimization}
          onChange={(e) => setOptimization(e.target.value)}
        >
          <option value="min_time">Минимальному времени</option>
          <option value="min_flight_distance">Суммарному налету</option>
        </select>
      </div>
    </aside>
  );
}