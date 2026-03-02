/**
 * AuthContext — Central authentication state for MessFlow.
 *
 * Supabase uses one session per browser. Logging in as another role
 * (e.g. switching from student to admin in the same browser) will
 * replace the existing session. This is expected Supabase behavior
 * and NOT a bug. Do not attempt multi-session support.
 */
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchingForRef = useRef(null); // tracks which userId is currently being fetched

    useEffect(() => {
        if (!isSupabaseConfigured) {
            setLoading(false);
            return;
        }

        // 1) Get the current session once on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        }).catch(() => {
            setLoading(false);
        });

        // 2) Listen for future auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription?.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        // Skip if we're already fetching for this exact user
        if (fetchingForRef.current === userId) return;
        fetchingForRef.current = userId;

        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;
            setProfile(data);
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            fetchingForRef.current = null;
            setLoading(false);
        }
    }

    async function signIn(email, password) {
        if (!isSupabaseConfigured) {
            throw new Error('Supabase is not configured. Add your credentials to the .env file.');
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
    }

    async function refreshProfile() {
        if (user) {
            await fetchProfile(user.id);
        }
    }

    const value = {
        user,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
        isStudent: profile?.role === 'student',
        isAdmin: profile?.role === 'admin',
        isConfigured: isSupabaseConfigured,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
