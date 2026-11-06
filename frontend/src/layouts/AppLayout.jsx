import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Mail, Activity, LogOut, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Gmail Inbox', icon: Mail },
  { to: '/health', label: 'Health Status', icon: Activity },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, primaryAccount, isAuthenticated, loginWithGoogle, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-sm
          flex flex-col transform transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Mail size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900">MailMind</span>
          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded ml-auto">
            AI
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-ring
                ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-gray-100">
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {primaryAccount?.emailAddress || user.email}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                title="Logout"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Button
              onClick={loginWithGoogle}
              variant="outline"
              size="sm"
              className="w-full text-xs justify-center"
              icon={<User size={14} />}
            >
              Sign In with Google
            </Button>
          )}
        </div>
      </aside>

      {/* ── Overlay (mobile) ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 focus-ring"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-sm font-semibold text-gray-800 tracking-wide">MailMind AI — Workspace</h1>
          </div>

          <div>
            {!isAuthenticated && (
              <Button onClick={loginWithGoogle} size="sm" variant="primary">
                Connect Gmail
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
