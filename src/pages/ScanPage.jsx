/**
 * ScanPage — Full-screen QR scan validation page.
 * Accessible to 'admin' and 'staff' roles only.
 * Dark theme, animated scanner, result cards with sounds.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { scanService } from '../services/scanService';
import { format } from 'date-fns';

// ─── Web Audio beep/buzz helpers ────────────────────────────────────────────
function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.connect(ctx.destination);

        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start(ctx.currentTime + i * 0.12);
            osc.stop(ctx.currentTime + i * 0.12 + 0.1);
        });
    } catch { /* ignore if audio blocked */ }
}

function playErrorSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.connect(ctx.destination);

        [220, 180].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start(ctx.currentTime + i * 0.18);
            osc.stop(ctx.currentTime + i * 0.18 + 0.15);
        });
    } catch { /* ignore if audio blocked */ }
}

// ─── Meal display helpers ────────────────────────────────────────────────────
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MEAL_ICON = { breakfast: '☀️', lunch: '🍽️', dinner: '🌙' };

export default function ScanPage() {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();

    // State machine: 'idle' | 'scanning' | 'success' | 'error' | 'processing'
    const [scanState, setScanState] = useState('idle');
    const [result, setResult] = useState(null); // { valid, booking, studentName, reason }
    const [scannerReady, setScannerReady] = useState(false);

    const scannerRef = useRef(null); // Html5QrcodeScanner instance
    const containerRef = useRef(null);
    const processingRef = useRef(false); // prevent double-fire

    const resetScanner = useCallback(() => {
        processingRef.current = false;
        setResult(null);
        setScanState('idle');
    }, []);

    // ── Mount / unmount the scanner ──────────────────────────────────────────
    useEffect(() => {
        let scanner = null;

        async function startScanner() {
            const { Html5QrcodeScanner, Html5QrcodeScanType } = await import('html5-qrcode');

            scanner = new Html5QrcodeScanner(
                'qr-reader',
                {
                    fps: 10,
                    qrbox: { width: 280, height: 280 },
                    rememberLastUsedCamera: true,
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                    showTorchButtonIfSupported: true,
                    showZoomSliderIfSupported: true,
                    defaultZoomValueIfSupported: 1.2,
                },
                /* verbose= */ false
            );

            scanner.render(onScanSuccess, onScanError);
            scannerRef.current = scanner;
            setScannerReady(true);
        }

        startScanner().catch(console.error);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => { });
                scannerRef.current = null;
            }
            setScannerReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── QR scan success callback ─────────────────────────────────────────────
    async function onScanSuccess(decodedText) {
        if (processingRef.current) return; // already handling a scan
        processingRef.current = true;
        setScanState('processing');

        try {
            const res = await scanService.validateAndScan(decodedText, user?.id);
            setResult(res);
            setScanState(res.valid ? 'success' : 'error');
            if (res.valid) playSuccessSound();
            else playErrorSound();
        } catch (err) {
            console.error('Scan error:', err);
            setResult({ valid: false, booking: null, studentName: '', reason: 'System error. Please retry.' });
            setScanState('error');
            playErrorSound();
        }
    }

    function onScanError() {
        // Suppress QR frame errors (they fire every frame without a code)
    }

    async function handleSignOut() {
        await signOut();
        navigate('/login');
    }

    const now = format(new Date(), 'EEEE, d MMM yyyy — h:mm a');

    return (
        <div style={styles.root}>
            {/* ── Top Bar ─────────────────────────────────────────────── */}
            <header style={styles.topBar}>
                <div style={styles.topBarLeft}>
                    <div style={styles.logo}>M</div>
                    <div>
                        <p style={styles.logoTitle}>MessFlow</p>
                        <p style={styles.logoSub}>QR Entry Scanner</p>
                    </div>
                </div>
                <div style={styles.topBarRight}>
                    <span style={styles.nowText}>{now}</span>
                    {profile?.role === 'admin' && (
                        <button
                            onClick={() => navigate('/admin/scan-logs')}
                            style={styles.logBtn}
                        >
                            📊 Scan Logs
                        </button>
                    )}
                    <div style={styles.userBadge}>
                        <span style={styles.userInitial}>{profile?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                        <span style={styles.userName}>{profile?.name || 'Staff'}</span>
                        <span style={styles.rolePill}>{profile?.role}</span>
                    </div>
                    <button onClick={handleSignOut} style={styles.signOutBtn} title="Sign out">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* ── Main Content ────────────────────────────────────────── */}
            <main style={styles.main}>

                {/* ── Scanner Box ─────────────────────────────────────── */}
                <div style={styles.scannerWrapper}>
                    {/* Idle / processing overlay */}
                    {(scanState === 'idle' || scanState === 'processing') && (
                        <div style={styles.scannerOverlayText}>
                            {scanState === 'processing' ? (
                                <>
                                    <div style={styles.spinner} />
                                    <p style={styles.idleLabel}>Validating…</p>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize: '2rem' }}>📷</span>
                                    <p style={styles.idleLabel}>Ready to Scan…</p>
                                    <p style={styles.idleSub}>Point camera at student's QR code</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* The actual scanner is injected here by html5-qrcode */}
                    <div
                        id="qr-reader"
                        ref={containerRef}
                        style={{
                            ...styles.qrReaderContainer,
                            opacity: scanState === 'idle' || scanState === 'processing' ? 0 : 1,
                            pointerEvents: (scanState === 'success' || scanState === 'error') ? 'none' : 'auto',
                        }}
                    />

                    {/* Animated scan line — shown when scanner is ready and idle */}
                    {scannerReady && scanState === 'idle' && (
                        <div style={styles.scanLineWrapper}>
                            <div style={styles.scanLine} />
                        </div>
                    )}

                    {/* Corner brackets */}
                    <div style={{ ...styles.corner, top: 12, left: 12, borderTop: '3px solid #22c55e', borderLeft: '3px solid #22c55e' }} />
                    <div style={{ ...styles.corner, top: 12, right: 12, borderTop: '3px solid #22c55e', borderRight: '3px solid #22c55e' }} />
                    <div style={{ ...styles.corner, bottom: 12, left: 12, borderBottom: '3px solid #22c55e', borderLeft: '3px solid #22c55e' }} />
                    <div style={{ ...styles.corner, bottom: 12, right: 12, borderBottom: '3px solid #22c55e', borderRight: '3px solid #22c55e' }} />
                </div>

                {/* ── Result Card ─────────────────────────────────────── */}
                {(scanState === 'success' || scanState === 'error') && result && (
                    <div
                        style={{
                            ...styles.resultCard,
                            ...(result.valid ? styles.resultCardValid : styles.resultCardInvalid),
                            animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                    >
                        {result.valid ? (
                            <>
                                <div style={styles.resultIcon}>✅</div>
                                <p style={styles.resultStatus}>VALID — ALLOW ENTRY</p>
                                <p style={styles.resultName}>{result.studentName}</p>
                                <div style={styles.resultMeta}>
                                    <span style={styles.metaPill}>
                                        {MEAL_ICON[result.booking?.meal_type]} {MEAL_LABEL[result.booking?.meal_type] || result.booking?.meal_type}
                                    </span>
                                    {result.booking?.slot_time && (
                                        <span style={styles.metaPill}>🕐 {result.booking.slot_time}</span>
                                    )}
                                    <span style={styles.metaPill}>📅 {result.booking?.date}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={styles.resultIcon}>❌</div>
                                <p style={styles.resultStatus}>ENTRY DENIED</p>
                                <p style={styles.resultReason}>{result.reason}</p>
                                {result.studentName && (
                                    <p style={styles.resultNameDim}>{result.studentName}</p>
                                )}
                            </>
                        )}

                        <button
                            onClick={resetScanner}
                            style={{
                                ...styles.resetBtn,
                                ...(result.valid ? styles.resetBtnValid : styles.resetBtnInvalid),
                            }}
                        >
                            ↩ Scan Next
                        </button>
                    </div>
                )}
            </main>

            {/* ── Global keyframe animations ──────────────────────────── */}
            <style>{`
                @keyframes scanMove {
                    0%   { top: 8%;  opacity: 1; }
                    45%  { top: 88%; opacity: 1; }
                    50%  { top: 88%; opacity: 0; }
                    51%  { top: 8%;  opacity: 0; }
                    55%  { top: 8%;  opacity: 1; }
                    100% { top: 8%;  opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(32px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                /* Override html5-qrcode default styles for dark theme */
                #qr-reader {
                    border: none !important;
                    background: transparent !important;
                    color: #94a3b8 !important;
                    font-family: inherit !important;
                }
                #qr-reader__scan_region {
                    background: transparent !important;
                }
                #qr-reader__scan_region img {
                    display: none !important;
                }
                #qr-reader video {
                    border-radius: 12px !important;
                    object-fit: cover !important;
                }
                #qr-reader__dashboard {
                    padding: 8px 0 0 !important;
                    background: transparent !important;
                }
                #qr-reader__dashboard_section_csr button,
                #qr-reader__dashboard_section_swaplink {
                    background: rgba(37,99,235,0.15) !important;
                    border: 1px solid rgba(37,99,235,0.4) !important;
                    color: #60a5fa !important;
                    border-radius: 8px !important;
                    padding: 6px 14px !important;
                    font-size: 12px !important;
                    cursor: pointer !important;
                }
                #qr-reader__dashboard_section_csr span,
                #qr-reader__dashboard_section_fsr span {
                    color: #64748b !important;
                    font-size: 12px !important;
                }
                #qr-reader__status_span {
                    display: none !important;
                }
                select {
                    background: #1e293b !important;
                    color: #94a3b8 !important;
                    border: 1px solid #334155 !important;
                    border-radius: 6px !important;
                    padding: 4px 8px !important;
                }
            `}</style>
        </div>
    );
}

// ─── Inline styles (dark theme, no Tailwind dependency) ────────────────────
const styles = {
    root: {
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0a0f1e 0%, #0d1832 50%, #050d1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#e2e8f0',
    },
    topBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(51,65,85,0.6)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '12px',
    },
    topBarLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    logo: {
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 900,
        fontSize: '18px',
        flexShrink: 0,
    },
    logoTitle: {
        margin: 0,
        fontSize: '15px',
        fontWeight: 700,
        color: '#f1f5f9',
        letterSpacing: '-0.01em',
    },
    logoSub: {
        margin: 0,
        fontSize: '11px',
        color: '#64748b',
        fontWeight: 500,
    },
    topBarRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
    },
    nowText: {
        fontSize: '12px',
        color: '#64748b',
    },
    logBtn: {
        background: 'rgba(37,99,235,0.15)',
        border: '1px solid rgba(37,99,235,0.35)',
        color: '#60a5fa',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    userBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(30,41,59,0.8)',
        border: '1px solid rgba(51,65,85,0.6)',
        borderRadius: '10px',
        padding: '6px 10px',
    },
    userInitial: {
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        background: 'rgba(37,99,235,0.25)',
        color: '#60a5fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '13px',
    },
    userName: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#e2e8f0',
    },
    rolePill: {
        fontSize: '10px',
        fontWeight: 700,
        color: '#818cf8',
        background: 'rgba(129,140,248,0.12)',
        padding: '2px 7px',
        borderRadius: '20px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    signOutBtn: {
        background: 'transparent',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#f87171',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    main: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        gap: '28px',
    },
    scannerWrapper: {
        position: 'relative',
        width: '380px',
        maxWidth: '95vw',
        minHeight: '380px',
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(51,65,85,0.5)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(37,99,235,0.12), 0 0 120px rgba(37,99,235,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerOverlayText: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        zIndex: 2,
        pointerEvents: 'none',
    },
    idleLabel: {
        margin: 0,
        fontSize: '17px',
        fontWeight: 700,
        color: '#e2e8f0',
    },
    idleSub: {
        margin: 0,
        fontSize: '12px',
        color: '#64748b',
    },
    qrReaderContainer: {
        width: '100%',
        padding: '16px',
        transition: 'opacity 0.3s',
    },
    scanLineWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 3,
    },
    scanLine: {
        position: 'absolute',
        left: '10%',
        right: '10%',
        height: '2px',
        background: 'linear-gradient(90deg, transparent 0%, #22c55e 30%, #4ade80 50%, #22c55e 70%, transparent 100%)',
        boxShadow: '0 0 12px #22c55e, 0 0 24px rgba(34,197,94,0.4)',
        borderRadius: '2px',
        animation: 'scanMove 2.4s ease-in-out infinite',
    },
    corner: {
        position: 'absolute',
        width: '24px',
        height: '24px',
        borderRadius: '3px',
        zIndex: 4,
    },
    spinner: {
        width: '36px',
        height: '36px',
        border: '3px solid rgba(37,99,235,0.2)',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    resultCard: {
        width: '420px',
        maxWidth: '95vw',
        borderRadius: '20px',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        textAlign: 'center',
        border: '1px solid',
    },
    resultCardValid: {
        background: 'linear-gradient(160deg, rgba(5,46,22,0.95) 0%, rgba(20,83,45,0.9) 100%)',
        borderColor: 'rgba(34,197,94,0.4)',
        boxShadow: '0 0 40px rgba(34,197,94,0.15), 0 8px 32px rgba(0,0,0,0.4)',
    },
    resultCardInvalid: {
        background: 'linear-gradient(160deg, rgba(69,10,10,0.95) 0%, rgba(127,29,29,0.9) 100%)',
        borderColor: 'rgba(239,68,68,0.4)',
        boxShadow: '0 0 40px rgba(239,68,68,0.15), 0 8px 32px rgba(0,0,0,0.4)',
    },
    resultIcon: {
        fontSize: '48px',
        lineHeight: 1,
    },
    resultStatus: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 800,
        letterSpacing: '0.05em',
        color: '#f1f5f9',
    },
    resultName: {
        margin: 0,
        fontSize: '24px',
        fontWeight: 700,
        color: '#d1fae5',
    },
    resultReason: {
        margin: 0,
        fontSize: '16px',
        fontWeight: 600,
        color: '#fca5a5',
        maxWidth: '300px',
    },
    resultNameDim: {
        margin: 0,
        fontSize: '15px',
        color: '#94a3b8',
    },
    resultMeta: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center',
        marginTop: '4px',
    },
    metaPill: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#a7f3d0',
        background: 'rgba(16,185,129,0.15)',
        border: '1px solid rgba(16,185,129,0.3)',
        padding: '4px 12px',
        borderRadius: '20px',
    },
    resetBtn: {
        marginTop: '12px',
        padding: '10px 28px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        border: '1px solid',
        transition: 'all 0.2s',
        letterSpacing: '0.02em',
    },
    resetBtnValid: {
        background: 'rgba(34,197,94,0.15)',
        borderColor: 'rgba(34,197,94,0.4)',
        color: '#4ade80',
    },
    resetBtnInvalid: {
        background: 'rgba(239,68,68,0.12)',
        borderColor: 'rgba(239,68,68,0.35)',
        color: '#f87171',
    },
};
