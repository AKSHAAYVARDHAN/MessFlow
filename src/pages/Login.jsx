import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { user, profile, loading, signIn, isConfigured } = useAuth();
    const navigate = useNavigate();

    // Redirect authenticated users away from /login
    useEffect(() => {
        if (!loading && user && profile) {
            const dest = profile.role === 'admin' ? '/admin' : '/student';
            navigate(dest, { replace: true });
        }
    }, [loading, user, profile, navigate]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            await signIn(email, password);
            // After signIn, AuthContext will update profile via onAuthStateChange.
            // The useEffect above will handle the redirect once profile loads.
        } catch (err) {
            setError(err.message || 'Invalid email or password');
            setSubmitting(false);
        }
    }

    // Show spinner while auth state is resolving
    if (loading) {
        return (
            <div className="login-bg flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-text-secondary text-sm font-medium">Loading…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-bg flex items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/25 animate-float">
                        <span className="text-3xl text-white font-bold">M</span>
                    </div>
                    <h1 className="text-2xl font-bold text-text">Welcome to MessFlow</h1>
                    <p className="text-text-secondary mt-1">Smart Meal Optimization System</p>
                </div>

                {/* Config Warning */}
                {!isConfigured && (
                    <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 animate-fade-in">
                        <p className="text-sm font-semibold text-warning mb-1">⚠️ Supabase Not Configured</p>
                        <p className="text-xs text-text-secondary">
                            Add your Supabase URL and Anon Key to the <code className="bg-bg px-1 py-0.5 rounded text-xs">.env</code> file to enable authentication and database features.
                        </p>
                    </div>
                )}

                {/* Login Card */}
                <div className="login-card">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 rounded-lg bg-danger/5 border border-danger/20 text-danger text-sm font-medium animate-fade-in">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="label">Email Address</label>
                            <input
                                type="email"
                                id="login-email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input"
                                placeholder="you@college.edu"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="label">Password</label>
                            <input
                                type="password"
                                id="login-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            id="login-submit"
                            disabled={submitting}
                            className="btn btn-primary w-full py-3 text-base"
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in…
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-border">
                        <p className="text-xs text-text-muted text-center leading-relaxed">
                            Students and Admins use the same login. Access is role-based.
                        </p>
                    </div>
                </div>

                {/* Guest booking link */}
                <div className="text-center mt-6">
                    <Link
                        to="/guest"
                        className="text-sm text-primary font-medium hover:text-primary-dark transition-colors"
                    >
                        Book as Guest →
                    </Link>
                </div>
            </div>
        </div>
    );
}
