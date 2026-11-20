import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Share2, Shield, Network, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-campus-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-campus-500/20 group-hover:scale-105 transition-transform">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">Constella<span className="text-campus-600">tion</span></span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-campus-100 text-campus-700 tracking-wider">NEO4J</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-none hidden sm:block">Graph-Based College Social Network</p>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link to="/" className="hover:text-campus-600 transition-colors">Overview</Link>
          <a href="#architecture" className="hover:text-campus-600 transition-colors">Neo4j Graph Schema</a>
          <a href="#fraud-detection" className="hover:text-campus-600 transition-colors flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-500" /> Fraud Detection
          </a>
          <Link to="/network" className="hover:text-campus-600 transition-colors flex items-center gap-1">
            <Network className="w-3.5 h-3.5 text-campus-600" /> Graph Visualizer
          </Link>
        </nav>

        {/* Auth CTA */}
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/dashboard">
              <Button size="sm" icon={ArrowRight}>
                Open Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">
                  Join Campus
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

