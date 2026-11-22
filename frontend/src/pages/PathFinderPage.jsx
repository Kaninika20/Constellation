import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch, Search, AlertTriangle, Info, ArrowRight,
  User, BookOpen, Users2, CalendarDays, Sparkles, Share2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import api from '../services/api';
import { useStudents } from '../hooks/useStudents';

// ─── Node type styles ─────────────────────────────────────────────────────────
const NODE_STYLES = {
  Student : { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300',   icon: User },
  Course  : { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', icon: BookOpen },
  Department: { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', icon: Users2 },
  Club    : { bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-300',  icon: Users2 },
  Event   : { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   icon: CalendarDays },
  Interest: { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-300',    icon: Sparkles },
  Unknown : { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300',   icon: Share2 },
};

// ─── Rel label pill ───────────────────────────────────────────────────────────
const REL_STYLES = {
  FRIENDS_WITH   : 'bg-blue-50   text-blue-700   border-blue-200',
  STUDIES        : 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEMBER_OF      : 'bg-purple-50 text-purple-700 border-purple-200',
  PARTICIPATES_IN: 'bg-amber-50  text-amber-700  border-amber-200',
  HAS_INTEREST   : 'bg-pink-50   text-pink-700   border-pink-200',
  FOLLOWS        : 'bg-red-50 text-red-700 border-red-200',
  BELONGS_TO     : 'bg-slate-100 text-slate-700 border-slate-300',
  OFFERED_BY     : 'bg-slate-100 text-slate-700 border-slate-300',
};

// ─── Mock result ──────────────────────────────────────────────────────────────
const MOCK_PATH = {
  found: true,
  distance: 3,
  message: 'Connected in 3 hops.',
  path: [
    { kind: 'node',  id: 'STU2026001', label: 'Aarav Sharma', type: 'Student', department: 'Computer Science' },
    { kind: 'rel',   label: 'FRIENDS_WITH' },
    { kind: 'node',  id: 'STU2026002', label: 'Priya Patel', type: 'Student', department: 'Data Science' },
    { kind: 'rel',   label: 'STUDIES' },
    { kind: 'node',  id: 'DS201', label: 'Data Mining and Social Network Analytics', type: 'Course' },
    { kind: 'rel',   label: 'STUDIES' },
    { kind: 'node',  id: 'STU2026003', label: 'Rohan Gupta', type: 'Student', department: 'Cybersecurity' },
  ],
};

// ─── Path node component ──────────────────────────────────────────────────────
const PathNode = ({ node }) => {
  const style = NODE_STYLES[node.type] || NODE_STYLES.Unknown;
  const Icon = style.icon;
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-2xl border-2 ${style.bg} ${style.border} min-w-[120px] max-w-[180px] shadow-sm`}>
      <div className={`w-8 h-8 rounded-xl ${style.bg} flex items-center justify-center mb-1.5 border ${style.border}`}>
        <Icon className={`w-4 h-4 ${style.text}`} />
      </div>
      <p className={`text-[11px] font-bold ${style.text} text-center leading-tight line-clamp-2`}>
        {node.label}
      </p>
      {node.department && (
        <p className="text-[9px] text-slate-500 mt-0.5 text-center">{node.department}</p>
      )}
      <span className={`mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
        {node.type}
      </span>
      {node.type === 'Student' && node.id && (
        <Link to={`/profile/${node.id}`}
          className="mt-1.5 text-[9px] text-campus-600 hover:underline font-semibold">
          Profile →
        </Link>
      )}
    </div>
  );
};

const PathArrow = ({ relLabel }) => {
  const cls = REL_STYLES[relLabel] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <div className="flex flex-col items-center gap-1 mx-1 shrink-0">
      <div className="w-px h-4 bg-slate-300" />
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
        :{relLabel}
      </span>
      <div className="flex items-center">
        <div className="w-px h-4 bg-slate-300" />
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-slate-400 -mt-1" />
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const PathFinderPage = () => {
  const { students, loading: loadingStudents, error: studentsError } = useStudents();
  const [studentA, setStudentA] = useState('');
  const [studentB, setStudentB] = useState('');
  const [maxHops, setMaxHops]   = useState(6);

  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [offline, setOffline]   = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!studentA.trim() || !studentB.trim()) return;
    if (studentA.trim() === studentB.trim()) {
      setError('Please select two different students.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setOffline(false);

    try {
      const res = await api.get(
        `/recommendations/path/${encodeURIComponent(studentA.trim())}/${encodeURIComponent(studentB.trim())}?maxHops=${maxHops}`
      );
      const data = res.data?.data;
      if (!data?.found) {
        setError(data?.message || 'No path found between these students within the hop limit.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not find connection path.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = () => {
    setStudentA('STU2026001');
    setStudentB('STU2026003');
    setResult(MOCK_PATH);
    setError('');
    setOffline(true);
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-campus-600" />
          Connection Path Finder
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Discover how any two students are connected through the Neo4j graph using shortest-path traversal
        </p>
      </div>

      {offline && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Database offline — showing demo path. Start Neo4j for live traversal.
        </div>
      )}

      {/* ── Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: search form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Find Connection"
              subtitle="Select two students by name to discover how they are linked"
            />
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label htmlFor="path-student-a" className="block text-xs font-semibold text-slate-700 mb-1">
                    Student A
                  </label>
                  <select
                    id="path-student-a"
                    value={studentA}
                    onChange={e => {
                      setStudentA(e.target.value);
                      setResult(null);
                      setError('');
                      setOffline(false);
                    }}
                    disabled={loadingStudents || Boolean(studentsError)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  >
                    <option value="">{loadingStudents ? 'Loading students…' : 'Select a student…'}</option>
                    {students.map(student => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.name || student.studentId} ({student.studentId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="path-student-b" className="block text-xs font-semibold text-slate-700 mb-1">
                    Student B
                  </label>
                  <select
                    id="path-student-b"
                    value={studentB}
                    onChange={e => {
                      setStudentB(e.target.value);
                      setResult(null);
                      setError('');
                      setOffline(false);
                    }}
                    disabled={loadingStudents || Boolean(studentsError)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  >
                    <option value="">{loadingStudents ? 'Loading students…' : 'Select a student…'}</option>
                    {students.map(student => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.name || student.studentId} ({student.studentId})
                      </option>
                    ))}
                  </select>
                </div>
                {studentsError && <p role="alert" className="text-xs text-red-600">{studentsError}</p>}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Hops: <span className="text-campus-600">{maxHops}</span>
                  </label>
                  <input
                    type="range" min="2" max="10" value={maxHops}
                    onChange={e => setMaxHops(Number(e.target.value))}
                    className="w-full accent-campus-600 h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>2</span><span>5</span><span>10</span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" isLoading={loading} disabled={loadingStudents || !studentA || !studentB} icon={Search}>
                  Find Shortest Path
                </Button>

                <button type="button" onClick={handleLoadDemo}
                  className="w-full text-xs text-slate-500 hover:text-campus-600 font-medium py-1 transition-colors">
                  Load demo (STU2026001 → STU2026003)
                </button>
              </form>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="p-4 bg-gradient-to-br from-campus-50 to-indigo-50 border-campus-200">
            <div className="flex items-start gap-2">
              <Share2 className="w-4 h-4 text-campus-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-2">
                <p className="font-bold text-slate-900">Neo4j shortestPath</p>
                <p className="font-mono bg-white/60 rounded p-2 text-[10px] leading-relaxed border border-campus-100 text-campus-900">
                  MATCH path = shortestPath(<br />
                  &nbsp;(a)-[:FRIENDS_WITH|FOLLOWS|STUDIES<br />
                  &nbsp;&nbsp;|MEMBER_OF|PARTICIPATES_IN|HAS_INTEREST<br />
                  &nbsp;&nbsp;|BELONGS_TO|OFFERED_BY*1..{maxHops}]-(b)<br />
                  )<br />
                  RETURN nodes(path),<br />
                  &nbsp;&nbsp;[r IN rels(path) | type(r)],<br />
                  &nbsp;&nbsp;length(path) AS hops
                </p>
                <p className="text-[11px] text-slate-500">
                  Traverses student, campus-entity, and department relationships. Returns the minimum-hop path and labels each step.
                </p>
              </div>
            </div>
          </Card>

          {/* Relationship type legend */}
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-800 mb-3">Relationship Types in Path</p>
            <div className="space-y-1.5">
              {Object.entries(REL_STYLES).map(([rel, cls]) => (
                <div key={rel} className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${cls}`}>
                  :{rel}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: path visualisation */}
        <div className="lg:col-span-3">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-3xl border border-slate-200 border-dashed p-8 text-center">
              <GitBranch className="w-14 h-14 text-slate-200 mb-4" />
              <h4 className="text-sm font-bold text-slate-700">No path computed yet</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Select two students on the left and click "Find Shortest Path" to visualise the connection chain.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Result header */}
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-900">{result.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {result.distance} relationship hop{result.distance !== 1 ? 's' : ''} in the graph
                  </p>
                </div>
                <Badge color={result.distance <= 2 ? 'emerald' : result.distance <= 4 ? 'blue' : 'amber'}>
                  {result.distance <= 2 ? 'Close' : result.distance <= 4 ? 'Nearby' : 'Distant'} connection
                </Badge>
              </div>

              {/* Path chain */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-x-auto">
                <p className="text-xs font-bold text-slate-600 mb-5 uppercase tracking-wider">Connection Chain</p>

                {/* Horizontal chain on md+, vertical on mobile */}
                <div className="hidden md:flex items-start gap-0 flex-wrap">
                  {result.path.map((item, idx) =>
                    item.kind === 'node' ? (
                      <PathNode key={idx} node={item} />
                    ) : (
                      <PathArrow key={idx} relLabel={item.label} />
                    )
                  )}
                </div>

                {/* Vertical chain on mobile */}
                <div className="flex md:hidden flex-col items-center gap-0">
                  {result.path.map((item, idx) =>
                    item.kind === 'node' ? (
                      <PathNode key={idx} node={item} />
                    ) : (
                      <div key={idx} className="flex flex-col items-center gap-1 my-1">
                        <div className="w-px h-3 bg-slate-300" />
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${REL_STYLES[item.label] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          :{item.label}
                        </span>
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Step-by-step list */}
              <Card>
                <CardHeader title="Step-by-step breakdown" subtitle="Each hop in the connection path" />
                <CardContent className="space-y-2 p-4">
                  {result.path
                    .filter(item => item.kind === 'node')
                    .map((node, idx, nodes) => {
                      const rel = result.path.find((item, i) => item.kind === 'rel' && i === idx * 2 + 1);
                      const isLast = idx === nodes.length - 1;
                      const style = NODE_STYLES[node.type] || NODE_STYLES.Unknown;
                      return (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${style.bg} ${style.text} border ${style.border}`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">{node.label}</span>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                                {node.type}
                              </span>
                            </div>
                            {node.department && <p className="text-[10px] text-slate-500">{node.department}</p>}
                            {!isLast && rel && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                via <span className={`font-bold ${REL_STYLES[rel.label]?.split(' ')[1] || 'text-slate-600'}`}>:{rel.label}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
