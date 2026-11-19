import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Users2,
  Users,
  Plus,
  Minus,
  Check,
  RefreshCw,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const ClubsPage = () => {
  const { user } = useAuth();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Selected club for viewing members
  const [selectedClub, setSelectedClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchClubs = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'mine') {
        res = await api.get('/clubs/joined');
      } else {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        res = await api.get(`/clubs${params.toString() ? `?${params.toString()}` : ''}`);
      }
      setClubs(res.data?.data || []);
    } catch (err) {
      console.warn('[ClubsPage] Could not load clubs from Neo4j');
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab !== 'all') setActiveTab('all');
    else fetchClubs();
  };

  const handleJoin = async (clubId) => {
    setActionLoading(`join_${clubId}`);
    setMessage('');
    try {
      await api.post(`/clubs/${clubId}/join`, { role: 'Member' });
      setMessage('Joined club successfully!');
      fetchClubs();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to join club');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = async (clubId) => {
    if (!window.confirm('Are you sure you want to leave this club?')) return;
    setActionLoading(`leave_${clubId}`);
    setMessage('');
    try {
      await api.post(`/clubs/${clubId}/leave`);
      setMessage('Left club successfully.');
      fetchClubs();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to leave club');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewMembers = async (club) => {
    setSelectedClub(club);
    setLoadingMembers(true);
    try {
      const res = await api.get(`/clubs/${club.clubId}/members`);
      if (res.data?.data) {
        setMembers(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load members');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users2 className="w-6 h-6 text-purple-600" />
            Campus Clubs & Co-Curricular Societies
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Explore and join campus communities connected via Neo4j [:MEMBER_OF] relationships
          </p>
        </div>

        <button
          onClick={fetchClubs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'all' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            All Clubs
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'mine' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            My Clubs
          </button>
        </div>

        {activeTab === 'all' && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name, category or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 sm:w-72 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
            />
            <Button type="submit" size="sm" className="text-xs">Search</Button>
          </form>
        )}
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-purple-500 hover:text-purple-800">✕</button>
        </div>
      )}

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clubs.map((club) => (
          <Card key={club.clubId} hover className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Users2 className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge color="purple">{club.category || 'Society'}</Badge>
                  {club.isMember && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Joined
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900">{club.name}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{club.description}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="text-slate-800">{club.memberCount || 0}</strong> Member{club.memberCount === 1 ? '' : 's'}
                </span>
                {club.myRole && (
                  <span className="text-[11px] text-purple-700 font-semibold">
                    Role: {club.myRole}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewMembers(club)}
                className="text-xs"
              >
                View Members
              </Button>

              {club.isMember ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleLeave(club.clubId)}
                  isLoading={actionLoading === `leave_${club.clubId}`}
                  className="text-xs text-red-600 hover:bg-red-50"
                  icon={Minus}
                >
                  Leave Club
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleJoin(club.clubId)}
                  isLoading={actionLoading === `join_${club.clubId}`}
                  className="text-xs"
                  icon={Plus}
                >
                  Join Club
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Members Modal */}
      {selectedClub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedClub.name}</h4>
                <p className="text-xs text-slate-500">Active Club Members ([:MEMBER_OF])</p>
              </div>
              <button
                onClick={() => setSelectedClub(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {loadingMembers ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading club members from Neo4j...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No members found in this club yet.</div>
              ) : (
                members.map(({ student, role }, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.name}`}
                        alt={student.name}
                        className="w-9 h-9 rounded-xl object-cover bg-white border border-slate-200"
                      />
                      <div>
                        <Link to={`/profile/${student.studentId}`} className="text-xs font-bold text-slate-800 hover:text-campus-600">
                          {student.name}
                        </Link>
                        <p className="text-[11px] text-slate-500">{student.department}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                      {role || 'Member'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedClub(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

