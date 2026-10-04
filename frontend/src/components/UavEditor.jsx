import { useState } from 'react';
import ModalShell from './ModalShell';
import { normalizeUav, UAV_FIELDS } from '../utils/uavCatalog';

export default function UavEditor({ model, cameras, isNew, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...model, cameras: [...model.cameras], name: isNew ? '' : model.name }));
  const [error, setError] = useState('');
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const submit = event => {
    event.preventDefault();
    try { onSave(normalizeUav(draft, cameras)); onClose(); }
    catch (err) { setError(err.message); }
  };

  return <ModalShell onClose={onClose} titleId="uav-editor-title" className="uav-editor" initialFocusSelector="#uav-model-name">
    <h3 id="uav-editor-title">{isNew ? 'Добавить дрон' : 'Изменить дрон'}</h3>
    <form onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="uav-model-name">Название модели</label>
        <input id="uav-model-name" required maxLength={100} value={draft.name} onChange={event => change('name', event.target.value)} />
      </div>
      <div className="uav-editor-grid">
        {UAV_FIELDS.map(([key, label, min, max]) => <div className="form-field" key={key}>
          <label htmlFor={`uav-${key}`}>{label}</label>
          <input id={`uav-${key}`} type="number" required min={min} max={max} step="any"
            value={draft[key]} onChange={event => change(key, event.target.value)} />
        </div>)}
      </div>
      <p className="form-hint">Для мультикоптера задайте радиус разворота и минимальную скорость 0.</p>
      <fieldset className="uav-editor-cameras">
        <legend>Совместимые камеры</legend>
        {cameras.map(camera => <label key={camera.id}>
          <input type="checkbox" checked={draft.cameras.includes(camera.id)} onChange={event => change('cameras',
            event.target.checked ? [...draft.cameras, camera.id] : draft.cameras.filter(id => id !== camera.id))} />
          <span>{camera.name || camera.id} <small>· {camera.type}</small></span>
        </label>)}
      </fieldset>
      <p className="form-hint">Модели и изменения сохраняются в этом браузере. Для переноса используйте экспорт запроса.</p>
      {error && <p className="uav-editor-error" role="alert">{error}</p>}
      <div className="uav-editor-actions">
        <button type="button" className="download-btn" onClick={onClose}>Отмена</button>
        <button type="submit" className="submit-btn">Сохранить</button>
      </div>
    </form>
  </ModalShell>;
}
