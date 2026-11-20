import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Search, RefreshCw, UserCheck, ArrowRight, Info, Share2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import api from '../services/api';
import { useStudents } from '../hooks/useStudents';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_FRIENDS = [
  { friend: { studentId: 'STU2026002', name: 'Priya Patel', department: 'Data Science', yearOfStudy: 4, profileImageUrl: '', bio: 'Researcher in graph neural networks.' }, since: null, interests: ['Machine Learning', 'Fraud Detection'] },
  { friend: { studentId: 'STU2026003', name: 'Rohan Gupta', department: 'Cybersecurity', yearOfStudy: 3, profileImageUrl: '', bio: 'Ethical hacker and security enthusiast.' }, since: null, interests: ['Cybersecurity', 'Fraud Detection'] },
];

const MOCK_MUTUAL = {
  STU2026002: { count: 1, mutualFriends: [{ student: { studentId: 'STU2026003', name: 'Rohan Gupta', department: 'Cybersecurity', yearOfStudy: 3, profileImageUrl: '' }, interests: ['Cybersecurity'] }] },
  STU2026003: { count: 1, mutualFriends: [{ student: { studentId: 'STU2026002', name: 'Priya Patel', department: 'Data Science', yearOfStudy: 4, profileImageUrl: '' }, interests: ['Machine Learning'] }] },
};

export const MutualConnectionsPage = () => {
  const { students, loading: loadingStudents, error: studentsError } = useStudents();

  const [friends, setFriends]           = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [offline, setOffline]           = useState(false);

  // lookup panel
  const [lookupId, setLookupId]         = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState('');

  // per-friend shared connection cache (now uses /shared endpoint)
  const [mutualCache, setMutualCache]   = useState({});
  const [expandedFriend, setExpandedFriend] = useState(null);
  const [expandLoading, setExpandLoading]   = useState(null);

  // ── Fetch current user's friends ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoadingFriends(true);
      try {
        const res = await api.get('/relationships/friends');
        const data = res.data?.data || [];
        if (data.length > 0) {
          setFriends(data);
        } else {
          setFriends(MOCK_FRIENDS);
          setOffline(true);
        }
      } catch {
        setFriends(MOCK_FRIENDS);
        setOffline(true);
      } finally {
        setLoadingFriends(false);
      }
    };
    load();
  }, []);

  // ── Expand shared connections for a specific friend ───────────────────────
  const handleExpandMutual = async (friendId) => {
    if (expandedFriend === friendId) {
      setExpandedFriend(null);
      return;
    }
    setExpandedFriend(friendId);
    if (mutualCache[friendId]) return;         // already fetched

    setExpandLoading(friendId);
    try {
      const res = await api.get(`/recommendations/shared/${friendId}`);
      setMutualCache(c => ({ ...c, [friendId]: res.data?.data || { counts: {}, mutualFriends: [], sharedCourses: [], sharedClubs: [], sharedInterests: [], commonEvents: [] } }));
    } catch {
      setMutualCache(c => ({ ...c, [friendId]: MOCK_MUTUAL[friendId] || { counts: {}, mutualFriends: [], sharedCourses: [], sharedClubs: [], sharedInterests: [], commonEvents: [] } }));
    } finally {
      setExpandLoading(null);
    }
  };

  // ── Arbitrary lookup ─────────────────────────────────────────────────────
  const handleLookup = async (e) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const res = await api.get(`/recommendations/shared/${encodeURIComponent(lookupId)}`);
      setLookupResult(res.data?.data || null);
    } catch (err) {
      if (err.response?.status === 404) {
        setLookupError('Student not found.');
      } else {
        setLookupError(err.response?.data?.message || 'Could not load shared connections.');
      }
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-campus-600" />
          Mutual Connections
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Discover shared friends between you and other students via Neo4j graph traversal
        </p>
      </div>

      {offline && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          Database offline — showing demo data. Start Neo4j for live results.
        </div>
      )}

      {/* ── Layout: 2 columns on lg ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Friend list with expandable mutual section */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader
              title={`Your Friends (${friends.length})`}
              subtitle="Click any friend to reveal mutual connections"
            />
            <CardContent className="space-y-3 p-4">
              {loadingFriends ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl bg-slate-50">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2 pt-1"><div className="h-3 bg-slate-200 rounded w-2/3" /><div className="h-2 bg-slate-100 rounded w-1/3" /></div>
                    </div>
                  ))}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No friends yet. Send some friend requests to get started.
                </div>
              ) : (
                friends.map(({ friend, interests }) => {
                  const fid = friend.studentId;
                  const isExpanded = expandedFriend === fid;
                  const mutual = mutualCache[fid];

                  return (
                    <div key={fid} className="rounded-2xl border border-slate-200 overflow-hidden">
                      {/* Friend row */}
                      <button
                        onClick={() => handleExpandMutual(fid)}
                        className="w-full flex items-center justify-between gap-3 p-3 bg-white hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={friend.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friend.name)}`}
                            alt={friend.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{friend.name}</p>
                            <p className="text-[11px] text-slate-500">{friend.department} · Year {friend.yearOfStudy}</p>
                            {interests.length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {interests.slice(0,2).map((it, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">#{it}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {mutual && (
                            <span className="text-[10px] font-bold text-campus-700 bg-campus-50 border border-campus-200 px-2 py-0.5 rounded-full">
                              {Object.values(mutual.counts || {}).reduce((a, b) => a + b, 0)} shared
                            </span>
                          )}
                          <span className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </span>
                        </div>
                      </button>

                      {/* Expanded shared connections panel */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                          {expandLoading === fid ? (
                            <div className="text-xs text-slate-400 text-center py-3 animate-pulse">
                              Traversing graph for shared connections…
                            </div>
                          ) : mutual ? (
                            (() => {
                              const totalShared = Object.values(mutual.counts || {}).reduce((a, b) => a + b, 0);
                              return totalShared === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-3">
                                  No shared connections found yet.
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {/* Summary chips */}
                                  <div className="flex flex-wrap gap-1.5">
                                    {mutual.counts.mutualFriends > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{mutual.counts.mutualFriends} mutual friend{mutual.counts.mutualFriends !== 1 ? 's' : ''}</span>}
                                    {mutual.counts.sharedCourses > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{mutual.counts.sharedCourses} shared course{mutual.counts.sharedCourses !== 1 ? 's' : ''}</span>}
                                    {mutual.counts.sharedClubs > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">{mutual.counts.sharedClubs} shared club{mutual.counts.sharedClubs !== 1 ? 's' : ''}</span>}
                                    {mutual.counts.sharedInterests > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">{mutual.counts.sharedInterests} shared interest{mutual.counts.sharedInterests !== 1 ? 's' : ''}</span>}
                                    {mutual.counts.commonEvents > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{mutual.counts.commonEvents} common event{mutual.counts.commonEvents !== 1 ? 's' : ''}</span>}
                                  </div>
                                  {/* Mutual friends list */}
                                  {(mutual.mutualFriends || []).map((mf) => (
                                    <div key={mf.studentId} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <img src={mf.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mf.name)}`} alt={mf.name} className="w-7 h-7 rounded-lg object-cover border border-slate-200 bg-white" />
                                        <div><p className="text-xs font-semibold text-slate-800">{mf.name}</p><p className="text-[10px] text-slate-500">{mf.department}</p></div>
                                      </div>
                                      <Link to={`/profile/${mf.studentId}`} className="text-[10px] text-campus-600 font-semibold hover:underline flex items-center gap-0.5">Profile <ArrowRight className="w-2.5 h-2.5" /></Link>
                                    </div>
                                  ))}
                                  {/* Shared courses */}
                                  {(mutual.sharedCourses || []).length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-500 mb-1">Shared Courses</p>
                                      {mutual.sharedCourses.map(c => <div key={c.courseCode} className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono mb-0.5">{c.courseCode} — {c.courseName}</div>)}
                                    </div>
                                  )}
                                  {/* Shared interests */}
                                  {(mutual.sharedInterests || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {mutual.sharedInterests.map(i => <span key={i.name} className="text-[9px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold">#{i.name}</span>)}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Arbitrary lookup panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Lookup Mutual Friends"
              subtitle="Select a student by name to find shared connections"
            />
            <CardContent>
              <form onSubmit={handleLookup} className="space-y-3">
                <div>
                  <label htmlFor="mutual-student" className="block text-xs font-semibold text-slate-700 mb-1">Student</label>
                  <select
                    id="mutual-student"
                    value={lookupId}
                    onChange={e => {
                      setLookupId(e.target.value);
                      setLookupResult(null);
                      setLookupError('');
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
                    {!loadingStudents && !studentsError && students.length === 0 && (
                      <option value="" disabled>No students found</option>
                    )}
                  </select>
                  {studentsError && <p role="alert" className="mt-1 text-xs text-red-600">{studentsError}</p>}
                </div>
                <Button type="submit" size="sm" className="w-full" isLoading={lookupLoading} disabled={loadingStudents || !lookupId} icon={Search}>
                  Find Mutual Friends
                </Button>
              </form>

              {lookupError && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">Shared connections</p>
                    <Badge color={Object.values(lookupResult.counts || {}).reduce((a,b)=>a+b,0) > 0 ? 'blue' : 'slate'}>
                      {Object.values(lookupResult.counts || {}).reduce((a,b)=>a+b,0)} total
                    </Badge>
                  </div>

                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {(lookupResult.counts?.mutualFriends > 0) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{lookupResult.counts.mutualFriends} mutual friends</span>}
                    {(lookupResult.counts?.sharedCourses > 0) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{lookupResult.counts.sharedCourses} courses</span>}
                    {(lookupResult.counts?.sharedClubs > 0) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">{lookupResult.counts.sharedClubs} clubs</span>}
                    {(lookupResult.counts?.sharedInterests > 0) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">{lookupResult.counts.sharedInterests} interests</span>}
                    {(lookupResult.counts?.commonEvents > 0) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{lookupResult.counts.commonEvents} events</span>}
                  </div>

                  {/* Mutual friends */}
                  {(lookupResult.mutualFriends || []).length > 0 && (
                    <div className="space-y-2">
                      {lookupResult.mutualFriends.map((mf) => (
                        <div key={mf.studentId} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={mf.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(mf.name)}`} alt={mf.name} className="w-8 h-8 rounded-xl object-cover border border-slate-200 bg-white shrink-0" />
                            <div className="min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{mf.name}</p><p className="text-[10px] text-slate-500">{mf.department}</p></div>
                          </div>
                          <Link to={`/profile/${mf.studentId}`} className="text-[10px] text-campus-600 font-semibold hover:underline shrink-0 flex items-center gap-0.5">Profile <ArrowRight className="w-2.5 h-2.5" /></Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shared courses */}
                  {(lookupResult.sharedCourses || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Shared Courses</p>
                      {lookupResult.sharedCourses.map(c => <div key={c.courseCode} className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono mb-0.5">{c.courseCode}</div>)}
                    </div>
                  )}

                  {/* Shared interests */}
                  {(lookupResult.sharedInterests || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {lookupResult.sharedInterests.map(i => <span key={i.name} className="text-[9px] px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold">#{i.name}</span>)}
                    </div>
                  )}

                  {/* Common events */}
                  {(lookupResult.commonEvents || []).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Common Events</p>
                      {lookupResult.commonEvents.map(e => <div key={e.eventId} className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 mb-0.5">{e.title}</div>)}
                    </div>
                  )}

                  {Object.values(lookupResult.counts || {}).reduce((a,b)=>a+b,0) === 0 && (
                    <p className="text-xs text-slate-400">No shared connections found with this student.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-start gap-2">
              <Share2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900">Cypher traversal</p>
                <p className="font-mono bg-white/60 rounded p-2 text-[10px] leading-relaxed border border-blue-100 text-blue-900">
                  MATCH (a)-[:FRIENDS_WITH]-(m)-[:FRIENDS_WITH]-(b)<br/>
                  WHERE m ≠ a AND m ≠ b<br/>
                  RETURN DISTINCT m
                </p>
                <p className="text-slate-500">Finds all nodes reachable by exactly 2 FRIENDS_WITH hops from both students.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
