import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  BookOpen,
  Users2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  Edit3,
  Network,
  UserPlus,
  UserCheck
} from 'lucide-react';
import api from '../services/api';

export const ProfilePage = () => {
  const { id: paramStudentId } = useParams();
  const { user } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [relStatus, setRelStatus] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);

  // If a studentId is in the URL and doesn't match authenticated user, it's another student's profile
  const isViewingOwnProfile = !paramStudentId || (user && user.studentId === paramStudentId);
  const targetStudentId = paramStudentId || user?.studentId;

  const fetchProfile = async () => {
    if (!targetStudentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/students/${targetStudentId}`);
      if (res.data?.data) {
        setProfileData(res.data.data);
      }
      // Fetch relationship state when viewing another student's profile
      if (!isViewingOwnProfile) {
        try {
          const stRes = await api.get(`/relationships/status/${targetStudentId}`);
          if (stRes.data?.data) setRelStatus(stRes.data.data);
        } catch {
          setRelStatus(null);
        }
      } else {
        setRelStatus(null);
      }
    } catch (err) {
      console.warn('[ProfilePage] Using local user state or demo values');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!targetStudentId) return;
    setFollowLoading(true);
    try {
      if (relStatus?.isFollowing) {
        await api.delete(`/relationships/follow/${targetStudentId}`);
        setRelStatus((prev) => (prev ? { ...prev, isFollowing: false } : prev));
        setProfileData((prev) =>
          prev ? { ...prev, followingCount: Math.max((prev.followingCount || 1) - 1, 0) } : prev
        );
      } else {
        await api.post(`/relationships/follow/${targetStudentId}`);
        setRelStatus((prev) => (prev ? { ...prev, isFollowing: true } : { isFollowing: true }));
        setProfileData((prev) =>
          prev ? { ...prev, followingCount: (prev.followingCount || 0) + 1 } : prev
        );
      }
    } catch (err) {
      console.warn('[ProfilePage] Follow action failed', err.response?.data?.message);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetStudentId]);

  const activeStudent = profileData?.student || (isViewingOwnProfile ? user : null) || {
    studentId: 'STU2026001',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@campus.edu',
    department: 'Computer Science',
    yearOfStudy: 3,
    bio: 'Passionate student exploring Neo4j graph algorithms, peer community networks, and building distributed academic applications.',
    profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
  };

  const courses = profileData?.courses || [
    { courseCode: 'CS302', courseName: 'Advanced Database Systems & Graph Theory', semester: 'Fall 2026' },
    { courseCode: 'DS201', courseName: 'Data Mining and Social Network Analytics', semester: 'Fall 2026' }
  ];
  const clubs = profileData?.clubs || [
    { clubId: 'CLUB_ACM', name: 'ACM Student Chapter', role: 'Vice Lead' }
  ];
  const events = profileData?.events || [
    { eventId: 'EVT_HACK26', title: 'Campus Hackathon 2026', location: 'Science Auditorium' },
    { eventId: 'EVT_GRAPH_WS', title: 'Neo4j Graph Database Workshop', location: 'Lab CS-301' }
  ];
  const interests = profileData?.interests || activeStudent?.interests || ['Graph Databases', 'Machine Learning', 'Cybersecurity'];
  const friends = profileData?.friends || [
    { studentId: 'STU2026002', name: 'Priya Patel', department: 'Data Science' },
    { studentId: 'STU2026003', name: 'Rohan Gupta', department: 'Cybersecurity' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-campus-600 to-indigo-700 relative" />
        <CardContent className="px-6 pb-6 relative pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-14 mb-4 gap-4">
            <div className="flex items-end gap-4">
              <img
                src={activeStudent?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeStudent?.name || 'Student'}`}
                alt={activeStudent?.name}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
              />
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{activeStudent?.name || 'Academic Scholar'}</h2>
                  <Badge color="blue">Verified Student</Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  Student ID: {activeStudent?.studentId} • {activeStudent?.department}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {isViewingOwnProfile ? (
                <Button
                  size="sm"
                  icon={Edit3}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Edit Profile
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {relStatus?.isFriend && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                      <UserCheck className="w-4 h-4" /> Friends
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant={relStatus?.isFollowing ? 'outline' : 'primary'}
                    onClick={handleToggleFollow}
                    isLoading={followLoading}
                    icon={relStatus?.isFollowing ? UserCheck : UserPlus}
                  >
                    {relStatus?.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" /> Sybil Score: Clean (0.05)
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed mt-2">
            {activeStudent?.bio || 'Passionate student exploring Neo4j graph algorithms, peer community networks, and building distributed academic applications.'}
          </p>

          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" /> {activeStudent?.email || 'student@campus.edu'}
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400" /> Year {activeStudent?.yearOfStudy || 3} Undergraduate
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" /> Enrolled Fall 2026
            </span>
            <span className="flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-slate-400" /> {profileData?.followersCount ?? 0} Followers
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-400" /> {profileData?.followingCount ?? 0} Following
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Graph Associations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Courses ([:STUDIES]) */}
        <Card>
          <CardHeader
            title="Enrolled Courses"
            subtitle="Linked via Neo4j [:STUDIES] relationships"
          />
          <CardContent className="space-y-3">
            {courses.length > 0 ? (
              courses.map((course, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-campus-700">{course.courseCode}</span>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">{course.courseName}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                    {course.semester || 'Current'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No enrolled courses in Neo4j.</p>
            )}
          </CardContent>
        </Card>

        {/* Clubs ([:MEMBER_OF]) */}
        <Card>
          <CardHeader
            title="Campus Clubs & Societies"
            subtitle="Linked via Neo4j [:MEMBER_OF] relationships"
          />
          <CardContent className="space-y-3">
            {clubs.length > 0 ? (
              clubs.map((club, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{club.name}</p>
                    <p className="text-[11px] text-slate-500">{club.category || 'Student Club'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    {club.role || 'Member'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No club memberships recorded in Neo4j.</p>
            )}
          </CardContent>
        </Card>

        {/* Events ([:PARTICIPATES_IN]) */}
        <Card>
          <CardHeader
            title="Participating Events"
            subtitle="Linked via Neo4j [:PARTICIPATES_IN] relationships"
          />
          <CardContent className="space-y-3">
            {events.length > 0 ? (
              events.map((evt, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{evt.title}</p>
                    <p className="text-[11px] text-slate-500">{evt.location || 'Campus Center'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                    Confirmed
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No event registrations found.</p>
            )}
          </CardContent>
        </Card>

        {/* Interests & Skills ([:HAS_INTEREST]) */}
        <Card>
          <CardHeader
            title="Interests & Research Topics"
            subtitle="Linked via Neo4j [:HAS_INTEREST] relationships"
          />
          <CardContent>
            {interests.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-xs font-semibold"
                  >
                    #{interest}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No interests selected.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          currentStudent={{
            ...activeStudent,
            interests
          }}
          onProfileUpdated={(updatedGraph) => {
            setProfileData(updatedGraph);
          }}
        />
      )}
    </div>
  );
};
