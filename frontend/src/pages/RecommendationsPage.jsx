import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, RefreshCw, UserPlus, Check, Info,
  Users, BookOpen, Users2, CalendarDays, Star,
  SlidersHorizontal, ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Score bar visualiser ────────────────────────────────────────────────────
const ScoreBar = ({ value, max, color }) => (
  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-500 ${color}`}
      style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%` }}
    />
  </div>
);

// ─── Reason chip ─────────────────────────────────────────────────────────────
const ReasonChip = ({ icon: Icon, label, count, color }) => {
  if (!count) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {count} {label}
    </span>
  );
};

// ─── Weight slider row ────────────────────────────────────────────────────────
const WeightRow = ({ label, value, onChange }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-slate-600 w-36 shrink-0">{label}</span>
    <input
      type="range" min="0" max="10" step="1" value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex-1 accent-campus-600 h-1.5"
    />
    <span className="text-xs font-bold text-slate-900 w-5 text-right">{value}</span>
  </div>
);

// ─── Mock data shown when Neo4j is offline ───────────────────────────────────
const MOCK_RECS = [
  {
    student: { studentId: 'STU2026003', name: 'Rohan Gupta', department: 'Cybersecurity', yearOfStudy: 3,
      bio: 'Ethical hacker focusing on Sybil cluster detection.', profileImageUrl: '' },
    interests: ['Cybersecurity', 'Fraud Detection'],
    score: { total: 11, breakdown: { commonFriends: 1, sharedCourses: 0, sharedInterests: 2, sharedClubs: 1, commonEvents: 0 },
      points: { fromFriends: 5, fromCourses: 0, fromInterests: 6, fromClubs: 2, fromEvents: 0 } },
    reasons: { mutualFriends: ['Priya Patel'], sharedCourses: [], sharedInterests: ['Fraud Detection', 'Graph Databases'], sharedClubs: ['ACM Student Chapter'], commonEvents: [] }
  },
  {
    student: { studentId: 'STU2026004', name: 'Ananya Deshmukh', department: 'Computer Science', yearOfStudy: 2,
      bio: 'Full-stack developer building React apps and interactive graph views.', profileImageUrl: '' },
    interests: ['UI/UX Design', 'Full-Stack Development'],
    score: { total: 8, breakdown: { commonFriends: 1, sharedCourses: 1, sharedInterests: 0, sharedClubs: 0, commonEvents: 1 },
      points: { fromFriends: 5, fromCourses: 3, fromInterests: 0, fromClubs: 0, fromEvents: 1 } },
    reasons: { mutualFriends: ['Priya Patel'], sharedCourses: ['Advanced Database Systems & Graph Theory'], sharedInterests: [], sharedClubs: [], commonEvents: ['Campus Hackathon 2026'] }
  },
  {
    student: { studentId: 'STU2026005', name: 'Vikram Verma', department: 'Information Technology', yearOfStudy: 4,
      bio: 'President of Web & Dev Club. Interested in scalable microservices.', profileImageUrl: '' },
    interests: ['Full-Stack Development', 'Cloud Computing'],
    score: { total: 6, breakdown: { commonFriends: 0, sharedCourses: 1, sharedInterests: 0, sharedClubs: 0, commonEvents: 0 },
      points: { fromFriends: 0, fromCourses: 3, fromInterests: 0, fromClubs: 0, fromEvents: 0 } },
    reasons: { mutualFriends: [], sharedCourses: ['Advanced Database Systems & Graph Theory'], sharedInterests: [], sharedClubs: [], commonEvents: [] }
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────
export const RecommendationsPage = () => {
  const { user } = useAuth();

  const [recommendations, setRecommendations] = useState([]);
  const [weights, setWeights]   = useState({ commonFriends: 5, sharedCourses: 3, sharedInterests: 3, sharedClubs: 2, commonEvents: 1 });
  const [loading, setLoading]   = useState(true);
  const [offline, setOffline]   = useState(false);
  const [showWeights, setShowWeights] = useState(false);

  // per-card connect state
  const [sentRequests, setSentRequests]     = useState({});
  const [connectLoading, setConnectLoading] = useState(null);
  const [toast, setToast]                   = useState('');

  const fetchRecs = useCallback(async (w = weights) => {
    setLoading(true);
    setOffline(false);
    try {
      const params = new URLSearchParams({
        wFriends:   w.commonFriends,
        wCourses:   w.sharedCourses,
        wInterests: w.sharedInterests,
        wClubs:     w.sharedClubs,
        wEvents:    w.commonEvents,
        limit: 20,
      });
      const res = await api.get(`/recommendations?${params}`);
      const data = res.data?.data?.recommendations || [];
      setRecommendations(data.length > 0 ? data : MOCK_RECS);
      if (data.length === 0) setOffline(true);
    } catch {
      setRecommendations(MOCK_RECS);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecs(weights); }, []);

  const handleWeightApply = () => {
    fetchRecs(weights);
    setShowWeights(false);
  };

  const handleConnect = async (studentId) => {
    setConnectLoading(studentId);
    setToast('');
    try {
      await api.post('/relationships/friend-requests', { targetStudentId: studentId });
      setSentRequests(prev => ({ ...prev, [studentId]: true }));
      setToast('Friend request sent!');
    } catch (err) {
      setToast(err.response?.data?.message || 'Could not send request.');
    } finally {
      setConnectLoading(null);
    }
  };

  const maxScore = recommendations.reduce((m, r) => Math.max(m, r.score?.total || 0), 1);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-campus-600" />
            Recommended Students
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Graph-based recommendations derived from friends, courses, clubs, interests and events in Neo4j
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button size="sm" variant="outline" onClick={() => setShowWeights(v => !v)}
            icon={SlidersHorizontal}>
            Tune Weights
          </Button>
          <Button size="sm" variant="secondary" onClick={() => fetchRecs(weights)}
            isLoading={loading} icon={RefreshCw}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Offline notice ── */}
      {offline && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          Database offline — showing demo recommendations. Start Neo4j and refresh for live data.
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="p-3 rounded-xl bg-campus-50 border border-campus-200 text-campus-800 text-xs flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast('')} className="ml-4 text-campus-500 hover:text-campus-800">✕</button>
        </div>
      )}

      {/* ── Weight tuner panel ── */}
      {showWeights && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Scoring Weights</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjust how much each relationship type contributes to the recommendation score
              </p>
            </div>
            <button onClick={() => setShowWeights(false)}
              className="text-slate-400 hover:text-slate-700">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 py-2">
            <WeightRow label="Common friends (×5 pts)" value={weights.commonFriends}
              onChange={v => setWeights(w => ({ ...w, commonFriends: v }))} />
            <WeightRow label="Shared courses (×3 pts)" value={weights.sharedCourses}
              onChange={v => setWeights(w => ({ ...w, sharedCourses: v }))} />
            <WeightRow label="Shared interests (×3 pts)" value={weights.sharedInterests}
              onChange={v => setWeights(w => ({ ...w, sharedInterests: v }))} />
            <WeightRow label="Shared clubs (×2 pts)" value={weights.sharedClubs}
              onChange={v => setWeights(w => ({ ...w, sharedClubs: v }))} />
            <WeightRow label="Common events (×1 pt)" value={weights.commonEvents}
              onChange={v => setWeights(w => ({ ...w, commonEvents: v }))} />
          </div>

          {/* current weight summary */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            {[
              { label: 'Friends', val: weights.commonFriends, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Courses', val: weights.sharedCourses, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Interests', val: weights.sharedInterests, color: 'bg-pink-50 text-pink-700 border-pink-200' },
              { label: 'Clubs', val: weights.sharedClubs, color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Events', val: weights.commonEvents, color: 'bg-amber-50 text-amber-700 border-amber-200' },
            ].map(({ label, val, color }) => (
              <span key={label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
                {label}: {val}
              </span>
            ))}
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleWeightApply} isLoading={loading}>
              Apply & Recalculate
            </Button>
          </div>
        </Card>
      )}

      {/* ── Algorithm explanation card ── */}
      <Card className="p-4 bg-gradient-to-r from-campus-50 to-indigo-50 border-campus-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-campus-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">How recommendations work</p>
            <p>
              Constellation traverses your Neo4j graph neighbourhood and scores each non-friend student.
              <span className="font-semibold text-campus-700"> Common friends = 5 pts, shared courses or interests = 3 pts each,
              shared clubs = 2 pts, common events = 1 pt.</span> Students already connected or with
              pending requests are excluded automatically.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Recommendation cards ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-3">
              <div className="flex gap-3"><div className="w-12 h-12 rounded-2xl bg-slate-200" /><div className="flex-1 space-y-2"><div className="h-3 bg-slate-200 rounded w-3/4" /><div className="h-2.5 bg-slate-100 rounded w-1/2" /></div></div>
              <div className="h-2 bg-slate-100 rounded w-full" />
              <div className="h-2 bg-slate-100 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No recommendations yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Enroll in courses, join clubs, attend events, and add interests to generate personalised suggestions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((rec) => {
            const { student, score, reasons, interests } = rec;
            const isSent = sentRequests[student.studentId];
            const isSelf = user?.studentId === student.studentId;

            return (
              <Card key={student.studentId} hover className="flex flex-col justify-between overflow-hidden">
                <div className="p-5">
                  {/* avatar + name */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(student.name)}`}
                        alt={student.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 bg-white shadow-xs"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{student.name}</h4>
                        <p className="text-[11px] text-slate-500">{student.department} · Year {student.yearOfStudy}</p>
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-campus-600 flex items-center justify-center shadow-sm shadow-campus-300">
                        <span className="text-sm font-extrabold text-white">{score.total}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5">score</span>
                    </div>
                  </div>

                  {/* bio */}
                  {student.bio && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">{student.bio}</p>
                  )}

                  {/* score bar */}
                  <div className="mb-3">
                    <ScoreBar value={score.total} max={maxScore} color="bg-campus-500" />
                  </div>

                  {/* reason chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <ReasonChip icon={Users}      count={score.breakdown.commonFriends}  label="mutual friend(s)"  color="bg-blue-50 text-blue-700 border-blue-200" />
                    <ReasonChip icon={BookOpen}   count={score.breakdown.sharedCourses}  label="shared course(s)"  color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    <ReasonChip icon={Sparkles}   count={score.breakdown.sharedInterests} label="common interest(s)" color="bg-pink-50 text-pink-700 border-pink-200" />
                    <ReasonChip icon={Users2}     count={score.breakdown.sharedClubs}    label="shared club(s)"    color="bg-purple-50 text-purple-700 border-purple-200" />
                    <ReasonChip icon={CalendarDays} count={score.breakdown.commonEvents} label="common event(s)"   color="bg-amber-50 text-amber-700 border-amber-200" />
                  </div>

                  {/* points breakdown */}
                  <div className="space-y-1.5 pb-1">
                    {score.breakdown.commonFriends > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold text-blue-700">+{score.points.fromFriends} pts</span> — mutual: {reasons.mutualFriends.slice(0,2).join(', ')}{reasons.mutualFriends.length > 2 ? ` +${reasons.mutualFriends.length - 2}` : ''}
                      </div>
                    )}
                    {score.breakdown.sharedCourses > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold text-emerald-700">+{score.points.fromCourses} pts</span> — {reasons.sharedCourses.slice(0,2).join(', ')}{reasons.sharedCourses.length > 2 ? ` +${reasons.sharedCourses.length - 2}` : ''}
                      </div>
                    )}
                    {score.breakdown.sharedInterests > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold text-pink-700">+{score.points.fromInterests} pts</span> — {reasons.sharedInterests.slice(0,3).join(', ')}
                      </div>
                    )}
                    {score.breakdown.sharedClubs > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold text-purple-700">+{score.points.fromClubs} pts</span> — {reasons.sharedClubs.join(', ')}
                      </div>
                    )}
                    {score.breakdown.commonEvents > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-semibold text-amber-700">+{score.points.fromEvents} pts</span> — {reasons.commonEvents.slice(0,2).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* candidate interests */}
                  {interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {interests.slice(0, 3).map((it, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">#{it}</span>
                      ))}
                      {interests.length > 3 && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 font-medium">+{interests.length - 3}</span>}
                    </div>
                  )}
                </div>

                {/* footer actions */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                  <Link to={`/profile/${student.studentId}`}
                    className="text-[11px] text-campus-600 font-semibold hover:underline flex items-center gap-1">
                    View Profile <ArrowRight className="w-3 h-3" />
                  </Link>

                  {!isSelf && (
                    isSent ? (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Sent
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect(student.studentId)}
                        isLoading={connectLoading === student.studentId}
                        icon={UserPlus} className="text-xs">
                        Connect
                      </Button>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
