import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LAST_MODULE_KEY = 'messflow_last_module';

const modules = [
  {
    id: 'mess',
    icon: '🍽️',
    title: 'Hostel Mess Booking',
    description: 'Book your daily hostel meals with ease',
    highlight: 'Book slots • Track attendance • Leave management',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
    shadowColor: 'rgba(37, 99, 235, 0.25)',
    shadowHover: 'rgba(37, 99, 235, 0.45)',
    path: '/student',
    badge: null,
  },
  {
    id: 'canteen',
    icon: '🍱',
    title: 'Canteen Pre-Order',
    description: 'Order food in advance and skip the queue',
    highlight: 'Order ahead • Pick up fresh • No waiting',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    shadowColor: 'rgba(245, 158, 11, 0.25)',
    shadowHover: 'rgba(245, 158, 11, 0.45)',
    path: '/canteen',
    badge: 'New',
  },
];

export default function ModuleSelection() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const lastModule = typeof window !== 'undefined'
    ? localStorage.getItem(LAST_MODULE_KEY)
    : null;

  function handleSelect(mod) {
    localStorage.setItem(LAST_MODULE_KEY, mod.id);
    navigate(mod.path);
  }

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="module-select-bg">
      {/* Top bar */}
      <header className="module-select-topbar">
        <div className="module-select-logo">
          <span>🍴</span> MessFlow
        </div>
        <div className="module-select-user">
          <span className="module-select-greeting">
            👋 {profile?.name ?? profile?.email?.split('@')[0] ?? 'Student'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut} id="signout-btn">
            Sign out
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="module-select-main">
        <div className="module-select-hero">
          <h1 className="module-select-title">What would you like to do?</h1>
          <p className="module-select-subtitle">
            {lastModule
              ? 'Welcome back — pick up where you left off'
              : 'Choose a module to get started'}
          </p>
        </div>

        {/* Module cards */}
        <div className="module-cards-grid">
          {modules.map((mod) => (
            <button
              key={mod.id}
              className="module-card"
              onClick={() => handleSelect(mod)}
              id={`module-${mod.id}-btn`}
              aria-label={`Open ${mod.title}`}
              style={{
                '--mod-gradient': mod.gradient,
                '--mod-shadow': mod.shadowColor,
                '--mod-shadow-hover': mod.shadowHover,
                outline: lastModule === mod.id ? '2.5px solid rgba(255,255,255,0.55)' : 'none',
                outlineOffset: '3px',
              }}
            >
              {lastModule === mod.id && (
                <span className="module-card-badge" style={{ background: 'rgba(255,255,255,0.22)', color: 'white', backdropFilter: 'blur(4px)' }}>
                  Last used
                </span>
              )}
              {mod.badge && lastModule !== mod.id && (
                <span className="module-card-badge">{mod.badge}</span>
              )}

              <div className="module-card-icon">{mod.icon}</div>

              <h2 className="module-card-title">{mod.title}</h2>
              <p className="module-card-desc">{mod.description}</p>

              <div className="module-card-highlight">
                {mod.highlight.split(' • ').map((h, i) => (
                  <span key={i} className="module-highlight-chip">{h}</span>
                ))}
              </div>

              <div className="module-card-cta">
                {lastModule === mod.id ? 'Continue →' : 'Get Started →'}
              </div>
            </button>
          ))}
        </div>

        <p className="module-select-footer">
          MessFlow — Smart Campus Food Management System
        </p>
      </main>
    </div>
  );
}
