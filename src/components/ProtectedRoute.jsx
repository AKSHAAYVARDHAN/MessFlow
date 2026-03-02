import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute — guards routes by authentication and role.
 *
 * Usage:
 *   <ProtectedRoute role="admin">              — only admins
 *   <ProtectedRoute role="student">            — only students
 *   <ProtectedRoute role={['admin','staff']}>  — admin or staff
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

    // Check role — supports string or array of allowed roles
    if (expectedRole) {
        const allowedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole];
        const userRole = profile?.role;

        if (!allowedRoles.includes(userRole)) {
            // Redirect to appropriate dashboard based on actual role
            if (userRole === 'admin') return <Navigate to="/admin" replace />;
            if (userRole === 'staff') return <Navigate to="/scan" replace />;
            return <Navigate to="/student" replace />;
        }
    }

    return children;
}
