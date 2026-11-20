import React, { useState, useEffect } from 'react';
import { Search, Bell, Menu, ShieldCheck, Database, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Badge } from './Badge';

export const Header = ({ onOpenSidebar }) => {
  const { user } = useAuth();
  const [dbStatus, setDbStatus] = useState({ connected: false, checking: true });

  useEffect(() => {
    const checkDbHealth = async () => {
      try {
        const res = await api.get('/health');
        setDbStatus({
          connected: res.data?.database?.connected || false,
          serverVersion: res.data?.database?.serverVersion || 'Neo4j 5.x',
          checking: false
        });
      } catch (err) {
        setDbStatus({ connected: false, checking: false });
      }
    };
    checkDbHealth();
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile Menu & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search students, courses, clubs, or events..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-100/80 border border-transparent rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-campus-400 focus:bg-white focus:ring-2 focus:ring-campus-100 transition-all"
          />
        </div>
      </div>

      {/* Right: DB status, Notification, Profile */}
      <div className="flex items-center gap-3">
        {/* Neo4j Connection Pill */}
        <div
          title={dbStatus.connected ? `Connected to Neo4j (${dbStatus.serverVersion})` : 'Neo4j offline. Start Neo4j on bolt://localhost:7687'}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            dbStatus.connected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{dbStatus.connected ? 'Neo4j Connected' : 'Neo4j Standby'}</span>
        </div>

        {/* Fraud Shield Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Fraud Radar Active</span>
        </div>

        {/* Notifications */}
        <button className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-campus-600"></span>
        </button>

        {/* Profile Pill */}
        <Link
          to="/profile"
          className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <img
            src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Student'}`}
            alt={user?.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-white"
          />
          <div className="hidden md:block text-left">
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-800 leading-tight">
              {user?.name || 'My Profile'}
              {user?.role === 'admin' && <Badge color="purple" className="px-1.5 py-0 text-[9px]">Admin</Badge>}
            </span>
            <span className="block text-[10px] text-slate-500 leading-tight">{user?.studentId || 'ID: STU2026'}</span>
          </div>
        </Link>
      </div>
    </header>
  );
};

