import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { supabase } from '../../services/supabase';

export default function NoShowMonitor() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStudents();
    }, []);

    async function fetchStudents() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'student')
                .gte('no_show_count', 3)
                .order('no_show_count', { ascending: false });
            if (error) throw error;
            setStudents(data || []);
        } catch (err) {
            console.error('Failed to fetch students:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleOverride(studentId) {
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    default_booking_enabled: true,
                    default_disabled_until: null,
                    no_show_count: 0,
                })
                .eq('id', studentId);
            if (error) throw error;
            await fetchStudents();
        } catch (err) {
            console.error('Override failed:', err);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-text">No-Show Monitor</h2>
                <p className="text-sm text-text-secondary mt-0.5">
                    Students with 3 or more no-shows
                </p>
            </div>

            <Card>
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="skeleton h-16 w-full" />
                        ))}
                    </div>
                ) : students.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-5xl mb-3">✅</div>
                        <h3 className="text-base font-semibold text-text">All Clear</h3>
                        <p className="text-sm text-text-secondary mt-1">
                            No students with excessive no-shows
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4">
                                        Student
                                    </th>
                                    <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4">
                                        Email
                                    </th>
                                    <th className="text-center text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4">
                                        No-Shows
                                    </th>
                                    <th className="text-center text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4">
                                        Status
                                    </th>
                                    <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider py-3 px-4">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => {
                                    const isDanger = student.no_show_count >= 5;
                                    const isDisabled =
                                        student.default_disabled_until &&
                                        new Date(student.default_disabled_until) > new Date();

                                    return (
                                        <tr
                                            key={student.id}
                                            className={`border-b border-border last:border-0 ${isDanger ? 'bg-danger/3' : ''
                                                }`}
                                        >
                                            <td className="py-3 px-4">
                                                <p className="text-sm font-medium text-text">{student.name}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <p className="text-sm text-text-secondary">{student.email}</p>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span
                                                    className={`badge ${isDanger ? 'badge-danger' : 'badge-warning'}`}
                                                >
                                                    {student.no_show_count}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {isDisabled ? (
                                                    <span className="badge badge-danger">Disabled</span>
                                                ) : (
                                                    <span className="badge badge-success">Active</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {isDanger && (
                                                    <button
                                                        onClick={() => handleOverride(student.id)}
                                                        className="btn btn-outline btn-sm"
                                                    >
                                                        Reset & Enable
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
