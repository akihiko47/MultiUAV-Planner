import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function ModalShell({ children, onClose, titleId, className = '', initialFocusSelector = '.submit-btn' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root.inert;
    root.inert = true;
    const dialog = dialogRef.current;
    dialog.querySelector(initialFocusSelector)?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, a[href], input, select')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      root.inert = wasInert;
      previous?.focus();
    };
  }, [onClose, initialFocusSelector]);
  return createPortal(<div className="modal-overlay" onClick={onClose}>
    <div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true"
      aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>{children}</div>
  </div>, document.body);
}
