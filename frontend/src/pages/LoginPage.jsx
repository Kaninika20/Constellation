import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { CygnusMark } from '../components/common/CygnusMark';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (demoEmail) => {
    setError('');
    setLoading(true);
    try {
      await demoLogin(demoEmail);
      navigate('/dashboard');
    } catch (err) {
      setError('Could not connect to Neo4j database. Ensure server is active or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-900 to-indigo-600 text-white shadow-md shadow-indigo-950/20 ring-1 ring-indigo-100 transition-transform group-hover:scale-105">
            <CygnusMark className="h-7 w-7" />
          </div>
          <span className="font-extrabold text-2xl text-slate-900 tracking-tight">Constella<span className="text-campus-600">tion</span></span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to your campus node
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Graph-authenticated student portal using JWT & Neo4j
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-3xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="student@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-campus-500 focus:bg-white focus:ring-2 focus:ring-campus-100 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-campus-500 focus:bg-white focus:ring-2 focus:ring-campus-100 transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={loading}
              icon={ArrowRight}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Login Section */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              One-Click Quick Test Accounts (Seeded)
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn('aarav.sharma@campus.edu')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-campus-400 hover:bg-campus-50/50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-800">Aarav Sharma (Computer Science)</div>
                  <div className="text-[10px] text-slate-500">aarav.sharma@campus.edu</div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-campus-100 text-campus-700">Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSignIn('priya.patel@campus.edu')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-campus-400 hover:bg-campus-50/50 flex items-center justify-between text-xs transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-800">Priya Patel (Data Science)</div>
                  <div className="text-[10px] text-slate-500">priya.patel@campus.edu</div>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-campus-100 text-campus-700">Login</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              New to campus?{' '}
              <Link to="/register" className="font-semibold text-campus-600 hover:text-campus-700">
                Register Student Node
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

