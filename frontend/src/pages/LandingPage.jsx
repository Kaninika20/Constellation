import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Share2,
  Database,
  Shield,
  Network,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Activity
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { CygnusMark } from '../components/common/CygnusMark';
import { Navbar } from '../components/common/Navbar';
import api from '../services/api';

export const LandingPage = () => {
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/health');
        setDbStatus(res.data?.database);
      } catch (err) {
        setDbStatus({ connected: false });
      }
    };
    fetchStatus();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-44 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="absolute right-[10%] top-24 h-48 w-48 rounded-full bg-cyan-100/70 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="relative mx-auto mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-900 to-indigo-600 shadow-xl shadow-indigo-950/20 ring-1 ring-white/70">
              <CygnusMark className="h-11 w-11 text-white" />
            </div>
            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-campus-50 border border-campus-200 text-campus-700 text-xs font-semibold mb-6 shadow-xs">
              <Sparkles className="w-4 h-4 text-campus-600" />
              <span>Neo4j Graph Database Academic Project</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Constella<span className="text-campus-600">tion</span>
            </h1>
            <p className="mt-3 text-xl sm:text-2xl font-medium text-slate-600">
              A Graph-Based College Social Network with Fraud Detection Using Neo4j
            </p>

            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Harness the power of Cypher queries, graph theory, and property graph algorithms to connect students,
              courses, clubs, events, and interests while safeguarding academic communities against sybil attacks and fraudulent accounts.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" icon={ArrowRight}>
                  Create Student Profile
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline" size="lg" icon={Network}>
                  Explore Graph Dashboard
                </Button>
              </Link>
            </div>

            {/* Neo4j Engine Status Pill */}
            <div className="mt-10 inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Database className="w-4 h-4 text-campus-600" /> Neo4j Native Driver:
              </span>
              {dbStatus?.connected ? (
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected to {dbStatus.uri}
                </span>
              ) : (
                <span className="text-amber-700 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Driver ready (bolt://localhost:7687)
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Graph Schema Architecture Section */}
      <section id="architecture" className="py-16 bg-slate-50 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-wider text-campus-600">Week 1 Schema Architecture</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">Property Graph Model Design</h3>
            <p className="text-slate-600 text-sm mt-2">
              Designed according to strict relational graph standards with 5 node labels and 6 verified relationship types.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Student Node */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">:Student (Core Node)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Unique Student ID, verified institutional email, academic department, year of study, bio, and bcrypt hash.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-blue-700 font-semibold">CONSTRAINT: studentId UNIQUE</div>
                <div className="text-blue-700 font-semibold">CONSTRAINT: email UNIQUE</div>
                <div>INDEX: department, yearOfStudy</div>
              </div>
            </div>

            {/* Course Node */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold mb-4">
                <BookOpen className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">:Course Node</h4>
              <p className="text-xs text-slate-500 mt-1">
                Academic curriculum entities linked via the <span className="font-mono text-emerald-700 font-semibold">[:STUDIES]</span> relationship.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-emerald-700 font-semibold">CONSTRAINT: courseCode UNIQUE</div>
                <div>INDEX: department</div>
                <div>Edge Props: semester, enrolledAt</div>
              </div>
            </div>

            {/* Club Node */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold mb-4">
                <Share2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">:Club Node</h4>
              <p className="text-xs text-slate-500 mt-1">
                Co-curricular societies linked via the <span className="font-mono text-purple-700 font-semibold">[:MEMBER_OF]</span> relationship.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-purple-700 font-semibold">CONSTRAINT: clubId UNIQUE</div>
                <div>Edge Props: role, joinedDate</div>
              </div>
            </div>

            {/* Event Node */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold mb-4">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">:Event Node</h4>
              <p className="text-xs text-slate-500 mt-1">
                Campus hackathons and workshops linked via <span className="font-mono text-amber-700 font-semibold">[:PARTICIPATES_IN]</span>.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-amber-700 font-semibold">CONSTRAINT: eventId UNIQUE</div>
                <div>INDEX: date</div>
              </div>
            </div>

            {/* Interest Node */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">:Interest Node</h4>
              <p className="text-xs text-slate-500 mt-1">
                Skills and topics linked via <span className="font-mono text-pink-700 font-semibold">[:HAS_INTEREST]</span> for Jaccard peer similarity.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-pink-700 font-semibold">CONSTRAINT: name UNIQUE</div>
                <div>Edge Props: level (Beginner/Adv)</div>
              </div>
            </div>

            {/* Social Edges: FRIENDS_WITH & FOLLOWS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mb-4">
                <Network className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Student-to-Student Edges</h4>
              <p className="text-xs text-slate-500 mt-1">
                Reciprocal <span className="font-mono text-indigo-700 font-semibold">[:FRIENDS_WITH]</span> and directed <span className="font-mono text-indigo-700 font-semibold">[:FOLLOWS]</span> for social graph modeling.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 font-mono text-[11px] text-slate-600 space-y-1">
                <div className="text-indigo-700 font-semibold">FRIENDS_WITH (Mutual)</div>
                <div className="text-indigo-700 font-semibold">FOLLOWS (Directed)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fraud Detection Highlight */}
      <section id="fraud-detection" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-campus-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold mb-4">
                <Shield className="w-3.5 h-3.5" /> Graph-Based Security Architecture
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Academic Sybil Defense & Bot Clustering
              </h3>
              <p className="text-slate-300 text-sm sm:text-base mt-3 leading-relaxed">
                Unlike traditional relational databases that struggle with multi-hop traversals, Neo4j allows Constellation
                to detect suspicious patterns in milliseconds: sudden burst followings, tightly knit synthetic cliques,
                and students without valid course or club associations.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-campus-400 font-bold mb-1">Sybil Detection</div>
                  <p className="text-slate-400 text-[11px]">Detects artificial account rings trying to game popularity.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-amber-400 font-bold mb-1">Centrality Scoring</div>
                  <p className="text-slate-400 text-[11px]">PageRank and betweenness centrality to evaluate real trust.</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-emerald-400 font-bold mb-1">Graph Triangles</div>
                  <p className="text-slate-400 text-[11px]">Local clustering coefficient validation for authentic friendships.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 text-center text-xs text-slate-500">
        <p>Constellation • Powered by Neo4j, Express, React, and Tailwind CSS.</p>
      </footer>
    </div>
  );
};

