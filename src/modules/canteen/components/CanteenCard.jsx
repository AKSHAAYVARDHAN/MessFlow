import { useNavigate } from 'react-router-dom';

/** Returns canteen status: 'open' | 'closing_soon' | 'closed' */
export function getCanteenStatus(canteen) {
  if (canteen.status === 'closed') return 'closed';
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = t => { const [h, m] = (t ?? '00:00').split(':').map(Number); return h * 60 + m; };
  const open = toMin(canteen.opening_time);
  const close = toMin(canteen.closing_time);
  if (cur < open || cur >= close) return 'closed';
  if (close - cur <= 30) return 'closing_soon';
  return 'open';
}

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const STATUS_CONFIG = {
  open:         { label: 'Open',         cls: 'ct-status-open',    dot: true },
  closing_soon: { label: 'Closing Soon', cls: 'ct-status-closing', dot: true },
  closed:       { label: 'Closed',       cls: 'ct-status-closed',  dot: false },
};

const BG_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
];

function deterministicGradient(id) {
  let hash = 0;
  for (const ch of (id ?? '')) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return BG_GRADIENTS[hash % BG_GRADIENTS.length];
}

export default function CanteenCard({ canteen }) {
  const navigate = useNavigate();
  const status = getCanteenStatus(canteen);
  const cfg = STATUS_CONFIG[status];
  const canOrder = status !== 'closed';

  return (
    <div
      className={`ct-canteen-card ${!canOrder ? 'ct-canteen-card--closed' : ''}`}
      onClick={() => canOrder && navigate(`/canteen/${canteen.id}/menu`)}
      role="button"
      tabIndex={canOrder ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && canOrder && navigate(`/canteen/${canteen.id}/menu`)}
    >
      {/* Banner */}
      <div
        className="ct-canteen-banner"
        style={{ background: canteen.image_url ? undefined : deterministicGradient(canteen.id) }}
      >
        {canteen.image_url && <img src={canteen.image_url} alt={canteen.name} />}
        <div className="ct-canteen-banner-overlay" />

        {/* Status badge */}
        <span className={`ct-status-badge ${cfg.cls}`}>
          {cfg.dot && <span className={`ct-status-dot ${status === 'open' ? 'pulse' : ''}`} />}
          {cfg.label}
        </span>

        {/* Canteen name on banner */}
        <div className="ct-canteen-banner-title">
          <h3>{canteen.name}</h3>
          {canteen.location && <p>📍 {canteen.location}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="ct-canteen-body">
        <div className="ct-canteen-hours">
          🕐 {fmt12(canteen.opening_time)} – {fmt12(canteen.closing_time)}
        </div>

        {canteen.description && (
          <p className="ct-canteen-desc">{canteen.description}</p>
        )}

        <button
          className={`btn ${canOrder ? 'btn-primary' : 'btn-secondary'} btn-sm ct-canteen-cta`}
          disabled={!canOrder}
          tabIndex={-1}
        >
          {canOrder ? 'View Menu →' : 'Currently Closed'}
        </button>
      </div>
    </div>
  );
}
