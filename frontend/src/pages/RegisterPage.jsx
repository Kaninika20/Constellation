import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, BookOpen, Calendar, FileText, Image as ImageIcon, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { CygnusMark } from '../components/common/CygnusMark';
import { useAuth } from '../context/AuthContext';

const departments = [
  'Computer Science',
  'Data Science',
  'Cybersecurity',
  'Information Technology',
  'Electronics & Communication',
  'Mathematics & Computing',
  'Mechanical Engineering'
];

const availableInterests = [
  'Graph Databases',
  'Machine Learning',
  'Fraud Detection',
  'Full-Stack Development',
  'Cybersecurity',
  'Cloud Computing',
  'Competitive Programming',
  'UI/UX Design',
  'Blockchain',
  'Robotics & AI'
];

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    studentId: `STU${Math.floor(100000 + Math.random() * 900000)}`,
    name: '',
    email: '',
    password: '',
    department: 'Computer Science',
    yearOfStudy: '2',
    bio: '',
    profileImageUrl: '',
    interests: ['Graph Databases', 'Machine Learning']
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(interest);
      return {
        ...prev,
        interests: exists
          ? prev.interests.filter(i => i !== interest)
          : [...prev.interests, interest]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        ...formData,
        yearOfStudy: parseInt(formData.yearOfStudy, 10)
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to register student node');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group mb-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-900 to-indigo-600 text-white shadow-md shadow-indigo-950/20 ring-1 ring-indigo-100">
              <CygnusMark className="h-6 w-6" />
            </div>
            <span className="font-extrabold text-2xl text-slate-900 tracking-tight">Constella<span className="text-campus-600">tion</span></span>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Register Student Node in Neo4j
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Create an academic identity with graph property attributes and constraints
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/80 rounded-3xl">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Student ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student ID (Unique Constraint)
                </label>
                <div className="relative">
                  <span className="text-xs font-mono font-bold text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STU2026001"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full pl-8 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Deshmukh"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Email (Unique)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="student@campus.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (Bcrypt Hashed)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Year of Study */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Year of Study
                </label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                >
                  <option value="1">1st Year (Freshman)</option>
                  <option value="2">2nd Year (Sophomore)</option>
                  <option value="3">3rd Year (Junior)</option>
                  <option value="4">4th Year (Senior)</option>
                </select>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic & Social Bio
              </label>
              <textarea
                rows="2"
                placeholder="Share your research interests, projects, or favorite tech stacks..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
              />
            </div>

            {/* Profile Image URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Profile Image URL (Optional)
              </label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://... (Leave blank for auto-generated avatar)"
                  value={formData.profileImageUrl}
                  onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Interests & Skills (HAS_INTEREST Cypher edges) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-campus-600" />
                Select Interests & Skills (creates [:HAS_INTEREST] edges)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableInterests.map(interest => {
                  const selected = formData.interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? 'bg-campus-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {selected ? `✓ ${interest}` : `+ ${interest}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={loading}
              icon={ArrowRight}
            >
              Register & Initialize Node
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-campus-600 hover:text-campus-700">
              Sign In to your Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

