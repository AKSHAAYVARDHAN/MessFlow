import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import Card from '../../components/Card';
import { feedbackService } from '../../services/feedbackService';
import { getToday } from '../../utils/dateHelpers';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const MEAL_COLORS = {
    breakfast: { accent: '#F59E0B', bg: '#FFFBEB', border: '#FCD34D', icon: '☀️', label: 'Breakfast' },
    lunch: { accent: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: '🍽️', label: 'Lunch' },
    dinner: { accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: '🌙', label: 'Dinner' },
};

const CHART_TOOLTIP_STYLE = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

function StarDisplay({ rating }) {
    return (
        <span className="tracking-tight" style={{ fontSize: '13px', letterSpacing: '1px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: i < rating ? '#F59E0B' : '#E2E8F0' }}>★</span>
            ))}
        </span>
    );
}

function SectionSkeleton({ height = 240 }) {
    return <div className="skeleton w-full rounded-xl" style={{ height }} />;
}

function EmptyState({ icon, text, sub }) {
    return (
        <div className="empty-state py-10">
            <div className="empty-state-icon">{icon}</div>
            <p className="empty-state-text">{text}</p>
            {sub && <p className="empty-state-sub">{sub}</p>}
        </div>
    );
}

/* ─── Daily Rating Card ───────────────────────────────────────────────────── */
function MealRatingCard({ mealKey, avg, loading }) {
    const config = MEAL_COLORS[mealKey];
    const needsAttention = avg !== null && avg < 3.0;

    return (
        <div
            className="card card-hover flex flex-col gap-3"
            style={{
                background: needsAttention
                    ? 'linear-gradient(135deg, #FEF2F2, #FFF)'
                    : `linear-gradient(135deg, ${config.bg}, #fff)`,
                borderColor: needsAttention ? '#FECACA' : config.border,
                borderWidth: '1.5px',
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{config.icon}</span>
                    <span className="text-sm font-semibold text-text">{config.label}</span>
                </div>
                {needsAttention && (
                    <span
                        className="badge text-[11px]"
                        style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}
                    >
                        ⚠ Needs Attention
                    </span>
                )}
            </div>

            {loading ? (
                <div className="skeleton h-10 w-24 rounded-lg" />
            ) : avg === null ? (
                <div>
                    <p className="text-2xl font-black text-text-muted">—</p>
                    <p className="text-xs text-text-muted mt-0.5">No ratings yet</p>
                </div>
            ) : (
                <div>
                    <div className="flex items-end gap-2">
                        <p
                            className="text-3xl font-black"
                            style={{ color: needsAttention ? '#DC2626' : config.accent }}
                        >
                            {avg.toFixed(1)}
                        </p>
                        <span className="text-base mb-1 opacity-70">/ 5</span>
                    </div>
                    <StarDisplay rating={Math.round(avg)} />
                </div>
            )}
        </div>
    );
}

/* ─── Custom Tooltip for Trend Chart ─────────────────────────────────────── */
function TrendTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value;
    return (
        <div style={CHART_TOOLTIP_STYLE} className="px-3 py-2">
            <p className="text-xs font-semibold text-text-secondary mb-1">{label}</p>
            {val != null ? (
                <p className="text-sm font-bold text-primary">{val.toFixed(1)} ⭐</p>
            ) : (
                <p className="text-sm text-text-muted">No data</p>
            )}
        </div>
    );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function MealFeedback() {
    const today = getToday();

    const [ratingsLoading, setRatingsLoading] = useState(true);
    const [trendLoading, setTrendLoading] = useState(true);
    const [commentsLoading, setCommentsLoading] = useState(true);

    const [dailyRatings, setDailyRatings] = useState({ breakfast: null, lunch: null, dinner: null });
    const [trendData, setTrendData] = useState([]);
    const [recentFeedback, setRecentFeedback] = useState([]);

    useEffect(() => {
        fetchAll();
    }, [today]);

    async function fetchAll() {
        setRatingsLoading(true);
        setTrendLoading(true);
        setCommentsLoading(true);

        feedbackService.getDailyAverageRatings(today)
            .then(setDailyRatings)
            .catch(console.error)
            .finally(() => setRatingsLoading(false));

        feedbackService.getFeedbackTrend(14)
            .then(setTrendData)
            .catch(console.error)
            .finally(() => setTrendLoading(false));

        feedbackService.getAllRecentFeedback(50)
            .then(setRecentFeedback)
            .catch(console.error)
            .finally(() => setCommentsLoading(false));
    }

    const hasLowRating = Object.values(dailyRatings).some(v => v !== null && v < 3.0);

    // Fill null gaps so chart renders as dashed
    const chartData = trendData.map(d => ({ ...d, avgDisplay: d.avg }));
    const hasAnyTrend = trendData.some(d => d.avg !== null);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Page Header ── */}
            <div>
                <h2 className="page-title">Meal Feedback</h2>
                <p className="page-subtitle">
                    {format(new Date(), 'EEEE, MMMM dd, yyyy')}
                    &nbsp;·&nbsp;Student meal ratings and comments
                </p>
            </div>

            {/* ── Low Rating Alert Banner ── */}
            {!ratingsLoading && hasLowRating && (
                <div
                    className="flex items-start gap-3 p-4 rounded-2xl animate-fade-in"
                    style={{ background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)', border: '1.5px solid #FECACA' }}
                >
                    <span className="text-2xl flex-shrink-0">🚨</span>
                    <div>
                        <p className="text-sm font-bold text-danger">Low Meal Ratings Today</p>
                        <p className="text-sm text-text-secondary mt-0.5">
                            One or more meals are rated below 3.0. Please review the recent comments and take action.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Today's Average Ratings ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="section-title">Today's Average Ratings</h3>
                    <span className="text-sm text-text-muted">{format(new Date(), 'MMM d, yyyy')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['breakfast', 'lunch', 'dinner'].map(meal => (
                        <MealRatingCard
                            key={meal}
                            mealKey={meal}
                            avg={dailyRatings[meal]}
                            loading={ratingsLoading}
                        />
                    ))}
                </div>
            </div>

            {/* ── 14-Day Trend Chart ── */}
            <Card title="Feedback Trend (Last 14 Days)" icon="📈">
                <p className="text-xs text-text-muted mb-4">Average rating per day across all meal types</p>
                {trendLoading ? (
                    <SectionSkeleton height={240} />
                ) : !hasAnyTrend ? (
                    <EmptyState
                        icon="📊"
                        text="No trend data yet"
                        sub="Ratings will appear here once students start submitting feedback."
                    />
                ) : (
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: '#94A3B8' }}
                                axisLine={false}
                                tickLine={false}
                                interval={1}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#94A3B8' }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 5]}
                                ticks={[1, 2, 3, 4, 5]}
                            />
                            <Tooltip content={<TrendTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="avgDisplay"
                                name="Avg Rating"
                                stroke="#2563EB"
                                strokeWidth={2.5}
                                dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: '#2563EB', strokeWidth: 0 }}
                                connectNulls={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Card>

            {/* ── Recent Feedback ── */}
            <Card title="Recent Feedback" icon="💬">
                <p className="text-xs text-text-muted mb-4">Latest student ratings and comments</p>
                {commentsLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="skeleton h-20 w-full rounded-xl" />
                        ))}
                    </div>
                ) : recentFeedback.length === 0 ? (
                    <EmptyState
                        icon="💭"
                        text="No feedback yet"
                        sub="Feedback will appear here once students rate their meals."
                    />
                ) : (
                    <div
                        className="space-y-3"
                        style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}
                    >
                        {recentFeedback.map((fb) => {
                            const mealCfg = MEAL_COLORS[fb.meal_type] || MEAL_COLORS.lunch;
                            const isLow = fb.rating < 3;
                            return (
                                <div
                                    key={fb.id}
                                    className="flex gap-3 p-4 rounded-xl border transition-all duration-200 hover:shadow-sm"
                                    style={{
                                        borderColor: isLow ? '#FECACA' : '#E2E8F0',
                                        background: isLow ? '#FEF2F2' : '#FAFAFA',
                                    }}
                                >
                                    {/* Avatar */}
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                                        style={{ background: mealCfg.bg, color: mealCfg.accent }}
                                    >
                                        {fb.users?.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-text truncate">
                                                    {fb.users?.name || 'Unknown'}
                                                </p>
                                                <span
                                                    className="badge text-[11px]"
                                                    style={{
                                                        background: mealCfg.bg,
                                                        color: mealCfg.accent,
                                                        border: `1px solid ${mealCfg.border}`,
                                                    }}
                                                >
                                                    {mealCfg.icon} {mealCfg.label}
                                                </span>
                                                {isLow && (
                                                    <span
                                                        className="badge text-[10px]"
                                                        style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}
                                                    >
                                                        ⚠ Low
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-text-muted flex-shrink-0">
                                                {format(new Date(fb.created_at), 'MMM d, h:mm a')}
                                            </p>
                                        </div>
                                        <StarDisplay rating={fb.rating} />
                                        {fb.comment && (
                                            <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
                                                "{fb.comment}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
