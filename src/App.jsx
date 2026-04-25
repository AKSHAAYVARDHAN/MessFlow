import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// ─── Existing pages ───────────────────────────────────────────────────────────
import Login from './pages/Login';
import ModuleSelection from './pages/ModuleSelection';
import TodayStatus from './pages/student/TodayStatus';
import LunchSlots from './pages/student/LunchSlots';
import DinnerSlots from './pages/student/DinnerSlots';
import LeaveForm from './pages/student/LeaveForm';
import Profile from './pages/student/Profile';
import MealHistory from './pages/student/MealHistory';
import StudentAnnouncements from './pages/student/Announcements';
import Overview from './pages/admin/Overview';
import Announcements from './pages/admin/Announcements';
import MenuManagement from './pages/admin/MenuManagement';
import NoShowMonitor from './pages/admin/NoShowMonitor';
import SlotMonitor from './pages/admin/SlotMonitor';
import LeaveMonitor from './pages/admin/LeaveMonitor';
import ScanLogs from './pages/admin/ScanLogs';
import Analytics from './pages/admin/Analytics';
import MealFeedback from './pages/admin/MealFeedback';
import GuestBooking from './pages/GuestBooking';
import ScanPage from './pages/ScanPage';

// ─── Canteen module ───────────────────────────────────────────────────────────
import { CartProvider } from './modules/canteen/context/CartContext';
import CanteenLayout from './modules/canteen/layout/CanteenLayout';
import CanteenList from './modules/canteen/pages/CanteenList';
import CanteenMenu from './modules/canteen/pages/CanteenMenu';
import Cart from './modules/canteen/pages/Cart';
import Checkout from './modules/canteen/pages/Checkout';
import Orders from './modules/canteen/pages/Orders';

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'staff') return <Navigate to="/scan" replace />;
  return <Navigate to="/select-module" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/guest" element={<GuestBooking />} />

            <Route path="/scan" element={
              <ProtectedRoute role={['admin', 'staff']}><ScanPage /></ProtectedRoute>
            } />

            <Route path="/select-module" element={
              <ProtectedRoute role="student"><ModuleSelection /></ProtectedRoute>
            } />

            {/* ─── Canteen module — nested under CanteenLayout ──────── */}
            <Route
              path="/canteen"
              element={
                <ProtectedRoute role="student">
                  <CartProvider>
                    <CanteenLayout />
                  </CartProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<CanteenList />} />
              <Route path="menu" element={<CanteenMenu />} />
              <Route path=":canteenId/menu" element={<CanteenMenu />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="orders" element={<Orders />} />
            </Route>

            {/* ─── Student routes ───────────────────────────────────── */}
            <Route path="/student" element={
              <ProtectedRoute role="student"><Layout /></ProtectedRoute>
            }>
              <Route index element={<TodayStatus />} />
              <Route path="announcements" element={<StudentAnnouncements />} />
              <Route path="lunch" element={<LunchSlots />} />
              <Route path="dinner" element={<DinnerSlots />} />
              <Route path="leave" element={<LeaveForm />} />
              <Route path="history" element={<MealHistory />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* ─── Admin routes ─────────────────────────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute role="admin"><Layout /></ProtectedRoute>
            }>
              <Route index element={<Overview />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="menu" element={<MenuManagement />} />
              <Route path="no-shows" element={<NoShowMonitor />} />
              <Route path="slots" element={<SlotMonitor />} />
              <Route path="leaves" element={<LeaveMonitor />} />
              <Route path="scan-logs" element={<ScanLogs />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="feedback" element={<MealFeedback />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
