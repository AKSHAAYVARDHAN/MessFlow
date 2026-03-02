import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// ─── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

let toastIdCounter = 0;

const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
};

const COLORS = {
    success: { border: '#16A34A', bg: '#F0FDF4', text: '#15803D', bar: '#16A34A' },
    error: { border: '#DC2626', bg: '#FEF2F2', text: '#991B1B', bar: '#DC2626' },
    warning: { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', bar: '#F59E0B' },
    info: { border: '#2563EB', bg: '#EFF6FF', text: '#1E40AF', bar: '#2563EB' },
};

// ─── Single Toast Item ───────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
    const [visible, setVisible] = useState(false);
    const colors = COLORS[toast.type] || COLORS.info;

    useEffect(() => {
        // Trigger enter animation
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    function handleDismiss() {
        setVisible(false);
        setTimeout(() => onRemove(toast.id), 300);
    }

    return (
        <div
            style={{
                transform: visible ? 'translateX(0)' : 'translateX(110%)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
                background: colors.bg,
                border: `1.5px solid ${colors.border}`,
                borderLeft: `4px solid ${colors.bar}`,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                minWidth: '280px',
                maxWidth: '360px',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <span style={{ fontSize: '16px', lineHeight: 1.2, flexShrink: 0 }}>{ICONS[toast.type]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && (
                    <p style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: toast.message ? '2px' : 0 }}>
                        {toast.title}
                    </p>
                )}
                {toast.message && (
                    <p style={{ fontSize: '13px', color: colors.text, opacity: 0.85, lineHeight: 1.4 }}>
                        {toast.message}
                    </p>
                )}
            </div>
            <button
                onClick={handleDismiss}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.text,
                    opacity: 0.5,
                    fontSize: '14px',
                    padding: '0 0 0 4px',
                    lineHeight: 1,
                    flexShrink: 0,
                }}
            >
                ✕
            </button>
            {/* Auto-dismiss progress bar */}
            <ProgressBar duration={toast.duration} colors={colors} onDone={handleDismiss} />
        </div>
    );
}

function ProgressBar({ duration, colors, onDone }) {
    const [width, setWidth] = useState(100);
    const startRef = useRef(Date.now());
    const rafRef = useRef(null);

    useEffect(() => {
        function tick() {
            const elapsed = Date.now() - startRef.current;
            const pct = Math.max(0, 100 - (elapsed / duration) * 100);
            setWidth(pct);
            if (pct > 0) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                onDone();
            }
        }
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                width: `${width}%`,
                background: colors.bar,
                opacity: 0.4,
                transition: 'none',
                borderRadius: '0 0 0 10px',
            }}
        />
    );
}

// ─── Container (Portal) ──────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null;
    return createPortal(
        <div
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'flex-end',
            }}
        >
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onRemove={onRemove} />
            ))}
        </div>,
        document.body
    );
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback(({ type = 'info', title, message, duration = 3500 }) => {
        const id = ++toastIdCounter;
        setToasts((prev) => [...prev, { id, type, title, message, duration }]);
        // Safety net removal
        setTimeout(() => removeToast(id), duration + 600);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useToast() {
    const addToast = useContext(ToastContext);
    if (!addToast) throw new Error('useToast must be used inside <ToastProvider>');

    return {
        success: (title, message) => addToast({ type: 'success', title, message }),
        error: (title, message) => addToast({ type: 'error', title, message }),
        warning: (title, message) => addToast({ type: 'warning', title, message }),
        info: (title, message) => addToast({ type: 'info', title, message }),
    };
}
