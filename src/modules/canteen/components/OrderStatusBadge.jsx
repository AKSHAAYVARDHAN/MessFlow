const STATUS = {
  not_preparing: { label: 'Not Preparing', emoji: '⏳', cls: 'ct-badge-gray',   pulse: false },
  preparing:     { label: 'Preparing',     emoji: '👨‍🍳', cls: 'ct-badge-orange', pulse: true  },
  prepared:      { label: 'Ready',         emoji: '✅', cls: 'ct-badge-green',  pulse: false },
};

export default function OrderStatusBadge({ status, size = 'md' }) {
  const cfg = STATUS[status] ?? STATUS.not_preparing;
  return (
    <span className={`ct-order-badge ${cfg.cls} ${size === 'sm' ? 'ct-order-badge-sm' : ''}`}>
      {cfg.pulse && <span className="ct-badge-pulse-dot" />}
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}
