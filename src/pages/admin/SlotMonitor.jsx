import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { bookingService } from '../../services/bookingService';
import { useRealtimeBookings } from '../../hooks/useRealtime';
import { LUNCH_SLOTS, DINNER_SLOTS } from '../../utils/constants';
import { getToday } from '../../utils/dateHelpers';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from 'recharts';

const BAR_COLORS = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#818CF8', '#A78BFA'];
const PIE_COLORS = ['#2563EB', '#16A34A', '#F59E0B'];

export default function SlotMonitor() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    const today = getToday();

    async function fetchData() {
        try {
            setLoading(true);
            const data = await bookingService.getBookingsByDate(today);
            setBookings(data);
        } catch (err) {
            console.error('Failed to fetch slot data:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [today]);

    useRealtimeBookings(today, () => {
        fetchData();
    });

    // Prepare data
    const lunchBookings = bookings.filter((b) => b.meal_type === 'lunch');
    const dinnerBookings = bookings.filter((b) => b.meal_type === 'dinner');

    const lunchData = LUNCH_SLOTS.map((slot) => ({
        name: slot.label,
        count: lunchBookings.filter((b) => b.slot_time === slot.value).length,
    }));

    const dinnerData = DINNER_SLOTS.map((slot) => ({
        name: slot.label,
        count: dinnerBookings.filter((b) => b.slot_time === slot.value).length,
    }));

    const mealDistribution = [
        { name: 'Breakfast', value: bookings.filter((b) => b.meal_type === 'breakfast').length },
        { name: 'Lunch', value: lunchBookings.length },
        { name: 'Dinner', value: dinnerBookings.length },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-text">Real-Time Slot Monitor</h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                        Live slot distribution updates
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
                    <span className="text-xs font-medium text-success">Live</span>
                </div>
            </div>

            {/* Meal Distribution Pie */}
            <Card title="Meal Distribution" icon="📊">
                {loading ? (
                    <div className="skeleton h-48 w-full" />
                ) : (
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={mealDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {mealDistribution.map((_, idx) => (
                                        <Cell key={idx} fill={PIE_COLORS[idx]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: '#fff',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-col gap-3">
                            {mealDistribution.map((item, idx) => (
                                <div key={item.name} className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ background: PIE_COLORS[idx] }}
                                    />
                                    <span className="text-sm text-text-secondary">{item.name}</span>
                                    <span className="text-sm font-semibold text-text">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>

            {/* Slot Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Lunch Slots (Live)" icon="🍽️">
                    {loading ? (
                        <div className="skeleton h-64 w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={lunchData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#fff',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                    }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {lunchData.map((_, idx) => (
                                        <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Dinner Slots (Live)" icon="🌙">
                    {loading ? (
                        <div className="skeleton h-64 w-full" />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={dinnerData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#fff',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                    }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {dinnerData.map((_, idx) => (
                                        <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>
        </div>
    );
}
