import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Users,
  Search,
  Filter,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Check
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const departments = [
  'All',
  'Computer Science',
  'Data Science',
  'Cybersecurity',
  'Information Technology',
  'Electronics & Communication',
  'Mathematics & Computing',
  'Mechanical Engineering'
];

export const StudentDirectoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');

  // Selected student for detailed graph modal
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [relStatus, setRelStatus] = useState(null);

  // Action status mapping
  const [connectLoading, setConnectLoading] = useState(null);
  const [sentRequests, setSentRequests] = useState({});
  const [toastMessage, setToastMessage] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedDept !== 'All') params.append('department', selectedDept);
      if (selectedYear !== 'All') params.append('yearOfStudy', selectedYear);

      const res = await api.get(`/students?${params.toString()}`);
      if (res.data?.data) {
        setStudents(res.data.data.students || []);
        setTotal(res.data.data.total || 0);
      }
    } catch (err) {
      console.warn('[StudentDirectory] Using fallback student directory list');
      setStudents([
        {
          studentId: 'STU2026001',
          name: 'Aarav Sharma',
          department: 'Computer Science',
          yearOfStudy: 3,
          bio: 'Passionate about graph analytics, Neo4j, and building social network algorithms.',
          interests: ['Graph Databases', 'Machine Learning', 'Algorithms'],
          friendsCount: 3,
          profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
        },
        {
          studentId: 'STU2026002',
          name: 'Priya Patel',
          department: 'Data Science',
          yearOfStudy: 4,
          bio: 'Researcher in graph neural networks, anomaly detection, and academic community detection.',
          interests: ['Data Mining', 'Machine Learning', 'Fraud Detection'],
          friendsCount: 2,
          profileImageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200'
        },
        {
          studentId: 'STU2026003',
          name: 'Rohan Gupta',
          department: 'Cybersecurity',
          yearOfStudy: 3,
          bio: 'Ethical hacker and security enthusiast focusing on Sybil cluster detection in social graphs.',
          interests: ['Cybersecurity', 'Fraud Detection'],
          friendsCount: 2,
          profileImageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200'
        },
        {
          studentId: 'STU2026004',
          name: 'Ananya Deshmukh',
          department: 'Computer Science',
          yearOfStudy: 2,
          bio: 'Full-stack developer building modern React apps, Tailwind layouts, and interactive graph views.',
          interests: ['UI/UX Design', 'Full-Stack Development'],
          friendsCount: 2,
          profileImageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200'
        }
      ]);
      setTotal(4);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedDept, selectedYear]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStudents();
  };

  const handleSendRequest = async (targetId) => {
    setConnectLoading(targetId);
    setToastMessage('');
    try {
      await api.post('/relationships/friend-requests', { targetStudentId: targetId });
      setSentRequests(prev => ({ ...prev, [targetId]: true }));
      setToastMessage('Friend request sent successfully!');
      if (selectedStudentDetail && selectedStudentDetail.student.studentId === targetId) {
        setRelStatus(prev => ({ ...prev, hasPendingOutgoing: true }));
      }
    } catch (err) {
      setToastMessage(err.response?.data?.message || 'Could not send friend request');
    } finally {
      setConnectLoading(null);
    }
  };

  const handleToggleFollow = async (targetId, currentlyFollowing) => {
    setConnectLoading(`follow_${targetId}`);
    setToastMessage('');
    try {
      if (currentlyFollowing) {
        await api.delete(`/relationships/follow/${targetId}`);
        setRelStatus(prev => ({ ...prev, isFollowing: false }));
        setToastMessage('Unfollowed student.');
      } else {
        await api.post(`/relationships/follow/${targetId}`);
        setRelStatus(prev => ({ ...prev, isFollowing: true }));
        setToastMessage('Now following student!');
      }
    } catch (err) {
      setToastMessage(err.response?.data?.message || 'Action failed');
    } finally {
      setConnectLoading(null);
    }
  };

  const handleViewProfileDetail = async (studentId) => {
    setLoadingDetail(true);
    setRelStatus(null);
    try {
      const [detailRes, statusRes] = await Promise.allSettled([
        api.get(`/students/${studentId}`),
        api.get(`/relationships/status/${studentId}`)
      ]);

      if (detailRes.status === 'fulfilled' && detailRes.value.data?.data) {
        setSelectedStudentDetail(detailRes.value.data.data);
      }
      if (statusRes.status === 'fulfilled' && statusRes.value.data?.data) {
        setRelStatus(statusRes.value.data.data);
      }
    } catch (err) {
      console.warn('Could not load student detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-campus-600" />
            Campus Student Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse and connect with students across departments stored in the Neo4j Graph Database
          </p>
        </div>

        <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-campus-50 border border-campus-200 text-campus-700 self-start sm:self-auto">
          {total} Student Node{total === 1 ? '' : 's'} Indexed
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-campus-50 border border-campus-200 text-campus-800 text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-campus-500 hover:text-campus-800">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, ID or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-campus-500 focus:bg-white"
            />
          </div>

          {/* Department Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>

          {/* Year of Study Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
            >
              <option value="All">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          {/* Actions */}
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="md" className="w-full text-xs" isLoading={loading}>
              Filter
            </Button>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('All');
                setSelectedYear('All');
              }}
              title="Reset Filters"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </Card>

      {/* Student Profile Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-campus-600 mx-auto mb-3"></div>
          Querying Neo4j database for student nodes...
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No students found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, department, or year filter to find fellow students.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => {
            const isSelf = user?.studentId === student.studentId;
            const isSent = sentRequests[student.studentId];

            return (
              <Card key={student.studentId} hover className="flex flex-col justify-between overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(student.name)}`}
                        alt={student.name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 bg-white shadow-xs"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{student.name}</h4>
                        <p className="text-[11px] font-mono text-campus-700 font-semibold">{student.studentId}</p>
                      </div>
                    </div>
                    <Badge color="blue">Year {student.yearOfStudy}</Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                    <p className="flex items-center gap-1.5 font-medium text-slate-700">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      {student.department}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {student.bio || 'Academic scholar participating in campus community groups.'}
                    </p>
                  </div>

                  {/* Interests Tags */}
                  {student.interests && student.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {student.interests.slice(0, 3).map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
                        >
                          #{item}
                        </span>
                      ))}
                      {student.interests.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 font-medium">
                          +{student.interests.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>

                {/* Card Footer Action */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {student.friendsCount || 0} Friend{student.friendsCount === 1 ? '' : 's'}
                  </span>

                  <div className="flex items-center gap-2">
                    {!isSelf && (
                      isSent ? (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Sent
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendRequest(student.studentId)}
                          isLoading={connectLoading === student.studentId}
                          className="text-xs text-campus-700 hover:bg-campus-50"
                          icon={UserPlus}
                        >
                          Connect
                        </Button>
                      )
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewProfileDetail(student.studentId)}
                      icon={ArrowRight}
                      className="text-xs"
                    >
                      Profile
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Another Student's Profile Detail Modal */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="h-28 bg-gradient-to-r from-campus-600 to-indigo-700 relative p-6 flex justify-end">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="px-6 pb-6 pt-0 relative">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 mb-4 gap-4">
                <div className="flex items-end gap-4">
                  <img
                    src={selectedStudentDetail.student?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudentDetail.student?.name}`}
                    alt={selectedStudentDetail.student?.name}
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedStudentDetail.student?.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      ID: {selectedStudentDetail.student?.studentId} • {selectedStudentDetail.student?.department}
                    </p>
                  </div>
                </div>

                {/* Social action buttons if not viewing self */}
                {user?.studentId !== selectedStudentDetail.student?.studentId && relStatus && (
                  <div className="flex items-center gap-2">
                    {relStatus.isFriend ? (
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Friends
                      </span>
                    ) : relStatus.hasPendingOutgoing ? (
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                        Request Pending
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSendRequest(selectedStudentDetail.student.studentId)}
                        isLoading={connectLoading === selectedStudentDetail.student.studentId}
                        icon={UserPlus}
                        className="text-xs"
                      >
                        Add Friend
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleFollow(selectedStudentDetail.student.studentId, relStatus.isFollowing)}
                      isLoading={connectLoading === `follow_${selectedStudentDetail.student.studentId}`}
                      className="text-xs"
                    >
                      {relStatus.isFollowing ? 'Unfollow' : 'Follow'}
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                {selectedStudentDetail.student?.bio || 'Active academic peer on Constellation.'}
              </p>

              {/* Follower / Following counts ([:FOLLOWS]) */}
              <div className="flex gap-4 mb-5 text-xs">
                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900">{selectedStudentDetail.followersCount ?? 0}</strong>
                  <span className="text-slate-500"> Followers</span>
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <strong className="text-slate-900">{selectedStudentDetail.followingCount ?? 0}</strong>
                  <span className="text-slate-500"> Following</span>
                </span>
              </div>

              {/* Neighborhood Graph Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Courses */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Courses ([:STUDIES])
                  </h5>
                  {selectedStudentDetail.courses?.length > 0 ? (
                    <ul className="space-y-1 text-slate-600 text-[11px]">
                      {selectedStudentDetail.courses.map((c, i) => (
                        <li key={i} className="font-medium">• {c.courseCode} - {c.courseName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No courses enrolled yet.</p>
                  )}
                </div>

                {/* Clubs */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span> Clubs ([:MEMBER_OF])
                  </h5>
                  {selectedStudentDetail.clubs?.length > 0 ? (
                    <ul className="space-y-1 text-slate-600 text-[11px]">
                      {selectedStudentDetail.clubs.map((cl, i) => (
                        <li key={i} className="font-medium">• {cl.name} ({cl.role || 'Member'})</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No club memberships recorded.</p>
                  )}
                </div>

                {/* Events */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Events ([:PARTICIPATES_IN])
                  </h5>
                  {selectedStudentDetail.events?.length > 0 ? (
                    <ul className="space-y-1 text-slate-600 text-[11px]">
                      {selectedStudentDetail.events.map((e, i) => (
                        <li key={i} className="font-medium">• {e.title}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No events registered.</p>
                  )}
                </div>

                {/* Interests */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <h5 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500"></span> Interests ([:HAS_INTEREST])
                  </h5>
                  {selectedStudentDetail.interests?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedStudentDetail.interests.map((it, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold">
                          #{it}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px]">No interests selected.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button size="md" variant="secondary" onClick={() => setSelectedStudentDetail(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
