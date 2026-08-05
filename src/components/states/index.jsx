import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './States.css';

// 1. Empty State
export function EmptyState({ title = "Nothing here yet", message, actionLabel, onAction }) {
  return (
    <div className="ui-state-container glass-panel">
      <div className="ui-state-icon ui-state-icon--empty">📭</div>
      <h3 className="ui-state-title">{title}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {actionLabel && onAction && (
        <button className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// 2. Loading State (Spinner & Skeleton)
export function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="ui-state-container">
      <div className="spinner" style={{ marginBottom: 16 }}></div>
      {message && <p className="ui-state-message">{message}</p>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-box" style={{ height: 60, width: '100%' }}></div>
      ))}
    </div>
  );
}

// 3. Error State
export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="ui-state-container glass-panel">
      <div className="ui-state-icon ui-state-icon--error">⚠️</div>
      <h3 className="ui-state-title">{title}</h3>
      {message && <p className="ui-state-message">{message}</p>}
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// 4. No Internet State (Global Banner)
export function NoInternetBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="network-banner">
      <span>📡</span>
      You are currently offline. Check your connection.
    </div>
  );
}

// 5. Slow Network State
export function SlowNetworkLoading({ timeoutMs = 3000, defaultMessage = "Loading...", slowMessage = "Still working on it..." }) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return <LoadingSpinner message={isSlow ? slowMessage : defaultMessage} />;
}

// 6. Permission Denied State
export function PermissionDeniedState({ title = "Access Denied", message = "You don't have permission to view this resource." }) {
  return (
    <div className="ui-state-container glass-panel">
      <div className="ui-state-icon ui-state-icon--lock">🔒</div>
      <h3 className="ui-state-title">{title}</h3>
      <p className="ui-state-message">{message}</p>
    </div>
  );
}

// 7. Session Expired State (Redirector)
export function SessionExpiredRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/login?expired=true', { replace: true });
  }, [navigate]);
  return <LoadingSpinner message="Session expired. Redirecting..." />;
}

// 8. Form Validation State
export function CustomAlert({ type = 'error', message }) {
  if (!message) return null;
  const isSuccess = type === 'success';

  return (
    <div style={{
      color: isSuccess ? '#059669' : '#dc2626',
      background: isSuccess ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.06)',
      border: isSuccess ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px',
      fontWeight: 500,
      marginTop: '8px',
      marginBottom: '16px',
      textAlign: 'center',
      lineHeight: 1.4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <span>{message}</span>
    </div>
  );
}

export function InlineError({ error }) {
  return <CustomAlert type="error" message={error} />;
}

export function InlineSuccess({ message }) {
  return <CustomAlert type="success" message={message} />;
}

// 9. Success State (Toast Manager)
// For simplicity in a global redesign without adding external libraries, 
// we provide a global toast hook/context or a simple local state toast.
let toastTimeout;
export function ToastSuccess({ message, visible, onClose }) {
  useEffect(() => {
    if (visible) {
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        if (onClose) onClose();
      }, 3000);
    }
    return () => clearTimeout(toastTimeout);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="toast-success">
      <span>✅</span> {message}
    </div>
  );
}
