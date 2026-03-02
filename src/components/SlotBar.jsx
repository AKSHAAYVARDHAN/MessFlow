export default function SlotBar({ slots, bookings, activeSlot, onSelect, disabled }) {
    // Count bookings per slot
    const counts = {};
    let total = 0;
    slots.forEach((s) => {
        const count = bookings.filter((b) => b.slot_time === s.value).length;
        counts[s.value] = count;
        total += count;
    });

    return (
        <div className="space-y-3">
            {slots.map((slot) => {
                const count = counts[slot.value] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isActive = activeSlot === slot.value;

                return (
                    <button
                        key={slot.value}
                        onClick={() => onSelect?.(slot.value)}
                        disabled={disabled}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${isActive
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : 'border-border hover:border-primary/30 hover:bg-surface-hover'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-text">{slot.label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-text-secondary">{count} booked</span>
                                <span className="text-xs text-text-muted">({pct}%)</span>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-border/60 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${Math.max(pct, 2)}%`,
                                    background: isActive
                                        ? 'var(--color-primary)'
                                        : pct > 60
                                            ? 'var(--color-warning)'
                                            : 'var(--color-success)',
                                }}
                            />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
