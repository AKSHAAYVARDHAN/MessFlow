export default function Card({ title, icon, badge, badgeType, children, className = '', action, noPad = false }) {
    return (
        <div className={`card ${noPad ? '!p-0 overflow-hidden' : ''} ${className}`}>
            {(title || badge || action) && (
                <div className={`flex items-center justify-between ${noPad ? 'px-6 pt-5 pb-4' : 'mb-5'}`}>
                    <div className="flex items-center gap-2.5">
                        {icon && (
                            <span className="text-xl leading-none">{icon}</span>
                        )}
                        {title && (
                            <h3 className="section-title">{title}</h3>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {badge && (
                            <span className={`badge ${badgeType || 'badge-info'}`}>{badge}</span>
                        )}
                        {action}
                    </div>
                </div>
            )}
            {noPad ? (
                <div className="px-6 pb-5">{children}</div>
            ) : (
                children
            )}
        </div>
    );
}
