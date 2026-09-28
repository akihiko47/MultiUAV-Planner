export default function RestrictionWarningModal({ ids, onClose }) {
  if (!ids || ids.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Требуется дополнительная проверка</h3>

        <p className="modal-text">
          Маршруты пересекают зоны ограничения полётов. Перед вылетом
          обязательно сверьтесь с БДВП и действующими приказами.
        </p>

        <ul className="modal-list">
          {ids.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>

        <p className="modal-note">
          Сверяйтесь с
          <strong> Бюллетенем доступности воздушного пространства (БДВП)</strong>
        </p>

        <div className="modal-links">
          <a
            href="https://app.matfmc.ru/AgreedRoutesView/ru?tab=cdr"
            target="_blank"
            rel="noopener noreferrer"
            className="modal-link">
            <span className="modal-link-title">БДВП</span>
            <span className="modal-link-sub">Проверить актуальные ограничения</span>
          </a>
        </div>

        <button className="submit-btn" onClick={onClose}>
          Понял, проверю
        </button>
      </div>
    </div>
  );
}