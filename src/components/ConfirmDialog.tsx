import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  children: ReactNode;          // the message
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog className="confirm" ref={ref} onCancel={onCancel} onClose={() => { if (open) onCancel(); }}>
      <div>{children}</div>
      <div className="dialog-actions" style={{ marginTop: 16 }}>
        <button className="btn btn--quiet" onClick={onCancel}>{cancelLabel}</button>
        <button className={danger ? 'btn btn--danger' : 'btn btn--primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
