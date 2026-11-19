import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  BookOpen,
  GraduationCap,
  Users,
  Plus,
  Minus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const CoursesPage = () => {
  const { user } = useAuth();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Selected course for viewing classmates
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [loadingClassmates, setLoadingClassmates] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'mine') {
        res = await api.get('/courses/enrolled');
      } else {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.append('search', searchTerm.trim());
        res = await api.get(`/courses${params.toString() ? `?${params.toString()}` : ''}`);
      }
      setCourses(res.data?.data || []);
    } catch (err) {
      console.warn('[CoursesPage] Could not load courses from Neo4j');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab !== 'all') setActiveTab('all');
    else fetchCourses();
  };

  const handleEnroll = async (courseCode) => {
    setActionLoading(`enroll_${courseCode}`);
    setMessage('');
    try {
      await api.post(`/courses/${courseCode}/enroll`, { semester: 'Fall 2026' });
      setMessage(`Successfully enrolled in ${courseCode}!`);
      fetchCourses();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to enroll');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDrop = async (courseCode) => {
    if (!window.confirm(`Are you sure you want to drop course ${courseCode}?`)) return;
    setActionLoading(`drop_${courseCode}`);
    setMessage('');
    try {
      await api.post(`/courses/${courseCode}/drop`);
      setMessage(`Dropped course ${courseCode}.`);
      fetchCourses();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to drop course');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewClassmates = async (course) => {
    setSelectedCourse(course);
    setLoadingClassmates(true);
    try {
      const res = await api.get(`/courses/${course.courseCode}/students`);
      if (res.data?.data) {
        setClassmates(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load classmates');
      setClassmates([]);
    } finally {
      setLoadingClassmates(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-600" />
            Curriculum & Academic Courses
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse campus courses and discover classmates enrolled via Neo4j [:STUDIES] relationships
          </p>
        </div>

        <button
          onClick={fetchCourses}
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            All Courses
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTab === 'mine' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            My Courses
          </button>
        </div>

        {activeTab === 'all' && (
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name, code or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 sm:w-72 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
            <Button type="submit" size="sm" className="text-xs">Search</Button>
          </form>
        )}
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-500 hover:text-emerald-800">✕</button>
        </div>
      )}

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card key={course.courseCode} hover className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {course.courseCode}
                </span>
                <Badge color="slate">{course.credits} Credits</Badge>
              </div>

              <h3 className="text-sm font-bold text-slate-900 leading-snug">{course.courseName}</h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" /> {course.department}
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="text-slate-800">{course.studentCount || 0}</strong> Enrolled
                </span>
                {course.isEnrolled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Enrolled ({course.enrolledSemester || 'Fall 2026'})
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewClassmates(course)}
                className="text-xs"
              >
                View Classmates
              </Button>

              {course.isEnrolled ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDrop(course.courseCode)}
                  isLoading={actionLoading === `drop_${course.courseCode}`}
                  className="text-xs text-red-600 hover:bg-red-50"
                  icon={Minus}
                >
                  Drop
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleEnroll(course.courseCode)}
                  isLoading={actionLoading === `enroll_${course.courseCode}`}
                  className="text-xs"
                  icon={Plus}
                >
                  Enroll
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Classmates Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Classmates in {selectedCourse.courseCode}
                </h4>
                <p className="text-xs text-slate-500">{selectedCourse.courseName}</p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {loadingClassmates ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading classmates from Neo4j...</div>
              ) : classmates.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No students currently enrolled in this course.</div>
              ) : (
                classmates.map(({ student, semester }, idx) => (
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
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {semester || 'Enrolled'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedCourse(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

