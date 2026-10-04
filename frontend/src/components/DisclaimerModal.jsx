import { useCallback, useState } from 'react';
import ModalShell from './ModalShell';

export default function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = useCallback(() => setIsOpen(false), []);

  if (!isOpen) return null;

  return (
    <ModalShell onClose={handleClose} titleId="disclaimer-title">
        <h3 id="disclaimer-title">Перед планированием</h3>

        <p className="modal-text">
          Пожалуйста, уточните запретные зоны перед вылетом.
          Наш сервис может не отображать актуальную информацию.
        </p>

        <p className="modal-note">
          Сверяйтесь с{' '}
          <strong>Бюллетенем доступности воздушного пространства</strong>
        </p>

        <div className="modal-links">
          <a
            href="https://app.matfmc.ru/AgreedRoutesView/ru?tab=cdr"
            target="_blank"
            rel="noopener noreferrer"
            className="modal-link"
          >
            <span className="modal-link-title">БДВП</span>
            <span className="modal-link-sub">Бюллетень доступности воздушного пространства</span>
          </a>
          <a
            href="https://www.garant.ru/products/ipo/prime/doc/413384888/#30"
            target="_blank"
            rel="noopener noreferrer"
            className="modal-link"
          >
            <span className="modal-link-title">Приказ о зонах ограничения полётов</span>
          </a>
          <a
            href="https://base.garant.ru/404831269/53f89421bbdaf741eb2d1ecc4ddb4c33/"
            target="_blank"
            rel="noopener noreferrer"
            className="modal-link"
          >
            <span className="modal-link-title">Перечень запретных зон</span>
          </a>
        </div>

        <button className="submit-btn" onClick={handleClose}>
          Понял
        </button>
    </ModalShell>
  );
}
