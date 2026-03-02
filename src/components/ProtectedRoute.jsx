import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — guards routes by authentication and role.
 *
 * Usage:
 *   <ProtectedRoute role="admin">   — only admins
 *   <ProtectedRoute role="student"> — only students
 *
 * Behavior:
 *   - Not authenticated → redirect to /login
 *   - Wrong role        → redirect to correct dashboard
 *   - Loading           → show spinner
 */
export default function ProtectedRoute({ children, role, requiredRole }) {
    const { user, profile, loading } = useAuth();
    const expectedRole = role || requiredRole; // support both prop names

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-text-secondary text-sm font-medium">Verifying access…</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (expectedRole && profile?.role !== expectedRole) {
        const redirect = profile?.role === 'admin' ? '/admin' : '/student';
        return <Navigate to={redirect} replace />;
    }

    return children;
}
