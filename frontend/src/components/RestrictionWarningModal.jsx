export default function RestrictionWarningModal({ ids, onClose }) {
  if (!ids || ids.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--warning"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Требуется дополнительная проверка</h3>

        <p className="modal-text">
          Маршруты пересекают зоны ограничения полётов. Перед вылетом
          обязательно сверьтесь с БДВП и действующими приказами.
        </p>

        {ids.length > 0 && (
          <>
            <p className="modal-zones-label">
              Затронутые зоны&nbsp;·&nbsp;{ids.length}
            </p>
            <div className="modal-zones">
              {ids.map((id) => (
                <span key={id} className="modal-zone">{id}</span>
              ))}
            </div>
          </>
        )}

        <div className="modal-links">
          <a
            href="https://app.matfmc.ru/AgreedRoutesView/ru?tab=cdr"
            target="_blank"
            rel="noopener noreferrer"
            className="modal-link"
          >
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