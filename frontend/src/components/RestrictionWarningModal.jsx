import ModalShell from './ModalShell';

export default function RestrictionWarningModal({ ids, onClose }) {
  if (!ids || ids.length === 0) return null;

  return (
    <ModalShell onClose={onClose} titleId="restriction-title" className="modal--warning">
        <h3 id="restriction-title">Требуется дополнительная проверка</h3>

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
    </ModalShell>
  );
}
