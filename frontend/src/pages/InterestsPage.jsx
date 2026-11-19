import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Sparkles, Search, Users, TrendingUp, Hash } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const InterestsPage = () => {
  const { user } = useAuth();
  const [interests, setInterests] = useState([]);
  const [popular, setPopular] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchInterests = async (term = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.append('search', term.trim());
      const res = await api.get(`/interests${params.toString() ? `?${params.toString()}` : ''}`);
      setInterests(res.data?.data || []);
    } catch (err) {
      console.warn('[InterestsPage] Could not load interests from Neo4j');
      setInterests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPopular = async () => {
    try {
      const res = await api.get('/interests/popular?limit=8');
      setPopular(res.data?.data || []);
    } catch (err) {
      setPopular([]);
    }
  };

  useEffect(() => {
    fetchInterests();
    fetchPopular();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInterests(searchTerm);
  };

  const handleViewStudents = async (interest) => {
    setSelected(interest);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/interests/${encodeURIComponent(interest.name)}/students`);
      setStudents(res.data?.data || []);
    } catch (err) {
      console.warn('Could not load students for interest');
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pink-600" />
            Interests &amp; Skills Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse Interest nodes, discover popular topics, and find students who share them via Neo4j [:HAS_INTEREST]
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search interests by name (e.g. Graph, Machine Learning, Cybersecurity)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:bg-white"
            />
          </div>
          <Button type="submit" size="md" className="text-xs">Search</Button>
        </form>
      </Card>

      {/* Popular Interests */}
      {popular.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-pink-600" /> Popular Interests
          </h3>
          <div className="flex flex-wrap gap-2">
            {popular.map((it) => (
              <button
                key={it.name}
                onClick={() => handleViewStudents(it)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-xs font-semibold hover:bg-pink-100 transition-colors"
              >
                <Hash className="w-3 h-3" />
                {it.name}
                <span className="text-[10px] font-medium text-pink-500 bg-pink-100 px-1.5 py-0.5 rounded-full">{it.studentCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All / searched interests */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-slate-500" />
          {searchTerm.trim() ? `Results for "${searchTerm.trim()}"` : 'All Interests'}
          <span className="text-[11px] font-normal text-slate-400">({interests.length})</span>
        </h3>

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">Querying Neo4j for Interest nodes...</div>
        ) : interests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No interests found. Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {interests.map((it) => (
              <Card key={it.name} className="p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-pink-500" /> {it.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{it.category || 'General'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <strong className="text-slate-800">{it.studentCount || 0}</strong>
                  </span>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handleViewStudents(it)}>
                    View Students
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Students sharing an interest modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-pink-600" /> {selected.name}
                </h4>
                <p className="text-xs text-slate-500">Students sharing this interest ([:HAS_INTEREST])</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {loadingStudents ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading students from Neo4j...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No students have this interest yet.</div>
              ) : (
                students.map(({ student, interests: stInterests }, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`}
                        alt={student.name}
                        className="w-9 h-9 rounded-xl object-cover bg-white border border-slate-200"
                      />
                      <div>
                        <Link to={`/profile/${student.studentId}`} className="text-xs font-bold text-slate-800 hover:text-pink-600">
                          {student.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">{student.department}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[55%]">
                      {(stInterests || []).slice(0, 3).map((t, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">#{t}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
