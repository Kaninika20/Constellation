import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Users,
  User,
  BookOpen,
  ClipboardList,
  Users2,
  CalendarDays,
  Sparkles,
  ShieldAlert,
  Shield,
  LogOut,
  Share2,
  UserCheck,
  GitBranch
} from 'lucide-react';
import { Badge } from './Badge';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Dashboard',         path: '/dashboard',          icon: LayoutDashboard },
  { label: 'My Network',        path: '/my-network',         icon: Users,      badge: 'Social' },
  { label: 'Student Directory', path: '/directory',          icon: Users2 },
  { label: 'My Profile',        path: '/profile',            icon: User },
  { label: 'Campus Clubs',      path: '/clubs',              icon: Users2 },
  { label: 'My Courses',        path: '/courses',            icon: BookOpen },
  { label: 'Campus Events',     path: '/events',             icon: CalendarDays },
  { label: 'Graph Visualizer',  path: '/network',            icon: Network },
  { label: 'Community Analysis', path: '/communities',       icon: Users2 },
  { label: 'Interests & Skills',path: '/interests',          icon: Sparkles },
  { label: 'Fraud Detection',   path: '/fraud-radar',        icon: ShieldAlert, badge: 'Protected' },
  // Week 4 — Recommendation Engine
  { label: 'Recommendations',   path: '/recommendations',    icon: Sparkles,   badge: 'AI' },
  { label: 'Mutual Connections',path: '/mutual-connections', icon: UserCheck },
  { label: 'Path Finder',       path: '/path-finder',        icon: GitBranch },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems = user?.role === 'admin'
    ? [
        ...navItems,
        { label: 'Admin Investigation', path: '/admin', icon: ShieldAlert, badge: 'Admin' },
        { label: 'Campus Catalog', path: '/admin/catalog', icon: ClipboardList, badge: 'Admin' },
        { label: 'Administrator Access', path: '/admin/access', icon: Shield, badge: 'Admin' }
      ]
    : navItems;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-campus-600 flex items-center justify-center text-white shadow-md shadow-campus-500/25">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-slate-900 tracking-tight">Constella<span className="text-campus-600">tion</span></span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Neo4j Powered</span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
            Campus Social Graph
          </p>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            // Insert a section divider before the Week 4 Recommendations group
            const isFirstRecoItem = item.path === '/recommendations';
            return (
              <React.Fragment key={item.path}>
                {isFirstRecoItem && (
                  <div className="pt-3 pb-1">
                    <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Recommendations
                    </p>
                  </div>
                )}
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-campus-50 text-campus-700 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </React.Fragment>
            );
          })}
        </div>

        {/* Database & Graph Status Box */}
        <div className="p-4 mx-3 mb-3 bg-gradient-to-br from-slate-900 to-campus-950 text-white rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-campus-200">Database Engine</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Bolt 7687
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">
            Nodes: Student, Course, Club, Event, Interest.
          </p>
        </div>

        {/* Profile Card & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <img
              src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Student'}`}
              alt={user?.name || 'Profile'}
              className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Guest Student'}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] text-slate-500 truncate">{user?.department || 'Computer Science'}</p>
                {user?.role === 'admin' && <Badge color="purple" className="px-1.5 py-0 text-[9px]">Admin</Badge>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

