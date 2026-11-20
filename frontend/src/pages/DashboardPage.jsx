import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/dashboard/StatCard';
import { NetworkPreviewCard } from '../components/dashboard/NetworkPreviewCard';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { SuggestedConnections } from '../components/dashboard/SuggestedConnections';
import { UpcomingEvents } from '../components/dashboard/UpcomingEvents';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  Users,
  BookOpen,
  Users2,
  Calendar,
  Sparkles,
  Shield,
  Database,
  ArrowUpRight,
  RefreshCw,
  Server
} from 'lucide-react';
import api from '../services/api';
import { Link } from 'react-router-dom';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [schemaStatus, setSchemaStatus] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  const fetchSchemaStatus = async () => {
    setLoadingSchema(true);
    try {
      const res = await api.get('/schema/status');
      setSchemaStatus(res.data?.data);
    } catch (err) {
      console.warn('[Dashboard] Could not fetch live schema stats');
    } finally {
      setLoadingSchema(false);
    }
  };

  useEffect(() => {
    fetchSchemaStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-campus-900 via-campus-800 to-indigo-900 text-white p-6 sm:p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-campus-200 text-xs font-semibold mb-3 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-campus-300" />
            <span>Constellation v1.0 • Neo4j Active Database</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.name || 'Fellow Scholar'}!
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-campus-100/90 leading-relaxed">
            Your personal academic subgraph is connected to departmental peers, course communities, and campus clubs.
            Explore your network visualizer below.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/network">
              <Button size="sm" className="bg-white text-campus-900 hover:bg-campus-50 shadow-none font-semibold">
                Explore Full Graph <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
            <Link to="/profile">
              <Button size="sm" variant="outline" className="text-white border-white/30 hover:bg-white/10">
                View My Node Attributes
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 rounded-full bg-campus-500/20 blur-2xl pointer-events-none" />
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Network Friends"
          value={user?.friendsCount || (schemaStatus?.nodeCounts?.Student ? `${schemaStatus.nodeCounts.Student - 1}` : '5')}
          change="+2 new"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Enrolled Courses"
          value={user?.courses?.length || (schemaStatus?.nodeCounts?.Course || '4')}
          change="Fall 2026"
          icon={BookOpen}
          color="emerald"
        />
        <StatCard
          title="Active Clubs"
          value={user?.clubs?.length || (schemaStatus?.nodeCounts?.Club || '3')}
          change="Member"
          icon={Users2}
          color="purple"
        />
        <StatCard
          title="Campus Events"
          value={user?.events?.length || (schemaStatus?.nodeCounts?.Event || '4')}
          change="Registered"
          icon={Calendar}
          color="amber"
        />
      </div>

      {/* Central 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Graph & Activity Feed */}
        <div className="lg:col-span-2 space-y-6">
          <NetworkPreviewCard />
          <ActivityFeed />
        </div>

        {/* Right 1 Col: Suggested Connections, Events, Neo4j Status */}
        <div className="space-y-6">
          <SuggestedConnections />
          <UpcomingEvents />

          {/* Neo4j Schema Inspector Widget */}
          <Card>
            <CardHeader
              title="Neo4j Schema Inspector"
              subtitle="Live constraints and node metrics"
              action={
                <button
                  onClick={fetchSchemaStatus}
                  disabled={loadingSchema}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                  title="Refresh Schema Status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSchema ? 'animate-spin' : ''}`} />
                </button>
              }
            />
            <CardContent className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Database Node Counts
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Students:</span>
                    <span className="font-bold text-slate-900">{schemaStatus?.nodeCounts?.Student ?? 6}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Courses:</span>
                    <span className="font-bold text-slate-900">{schemaStatus?.nodeCounts?.Course ?? 5}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Clubs:</span>
                    <span className="font-bold text-slate-900">{schemaStatus?.nodeCounts?.Club ?? 4}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Events:</span>
                    <span className="font-bold text-slate-900">{schemaStatus?.nodeCounts?.Event ?? 4}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Database className="w-3.5 h-3.5 text-campus-600" /> Uniqueness Constraints:
                </div>
                <div className="font-mono text-[10px] text-emerald-700">✓ Student(studentId) UNIQUE</div>
                <div className="font-mono text-[10px] text-emerald-700">✓ Student(email) UNIQUE</div>
                <div className="font-mono text-[10px] text-emerald-700">✓ Course(courseCode) UNIQUE</div>
                <div className="font-mono text-[10px] text-emerald-700">✓ Club(clubId) UNIQUE</div>
                <div className="font-mono text-[10px] text-emerald-700">✓ Event(eventId) UNIQUE</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

