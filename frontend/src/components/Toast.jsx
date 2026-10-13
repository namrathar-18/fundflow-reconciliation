import React, { useEffect } from 'react';
import { IconCheck, IconAlertTriangle, IconX } from './Icons';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className={`toast-item toast-${toast.type || 'info'}`}>
      <div className="toast-icon">
        {isSuccess && <IconCheck size={16} />}
        {isError && <IconAlertTriangle size={16} />}
        {!isSuccess && !isError && <IconCheck size={16} />}
      </div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
