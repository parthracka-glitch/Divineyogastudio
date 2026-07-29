import { X } from "../icons";

export default function Modal({ isOpen, onClose, title, subtitle, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="modal-backdrop">
      <div className="modal-container" onClick={(e) => e.stopPropagation()} data-testid="modal-container">
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} data-testid="modal-close-button">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
