import React, { useState } from 'react';
import { X, Save, AlertCircle, Sparkles, User, GraduationCap, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../common/Button';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
  'Robotics & AI',
  'Algorithms',
  'Data Mining'
];

export const EditProfileModal = ({ isOpen, onClose, currentStudent, onProfileUpdated }) => {
  const { updateUser } = useAuth();

  const [formData, setFormData] = useState({
    name: currentStudent?.name || '',
    department: currentStudent?.department || 'Computer Science',
    yearOfStudy: String(currentStudent?.yearOfStudy || '3'),
    bio: currentStudent?.bio || '',
    profileImageUrl: currentStudent?.profileImageUrl || '',
    interests: currentStudent?.interests || []
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toggleInterest = (interest) => {
    setFormData(prev => {
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
    setSuccess('');
    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        department: formData.department.trim(),
        yearOfStudy: parseInt(formData.yearOfStudy, 10),
        bio: formData.bio.trim(),
        profileImageUrl: formData.profileImageUrl.trim(),
        interests: formData.interests
      };

      const res = await api.put(`/students/${currentStudent.studentId}`, payload);
      setSuccess('Profile and graph interests updated successfully in Neo4j!');

      // Update global context
      if (res.data?.data?.student) {
        updateUser(res.data.data.student);
      }

      if (onProfileUpdated) {
        onProfileUpdated(res.data.data);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Student Profile Node</h3>
            <p className="text-xs text-slate-500">ID: {currentStudent?.studentId} (Strictly Protected)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <span>✅ {success}</span>
            </div>
          )}

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
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
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
              Short Bio
            </label>
            <textarea
              rows="3"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
              placeholder="Tell other students about your research topics and interests..."
            />
          </div>

          {/* Profile Image URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Profile Image URL
            </label>
            <div className="relative">
              <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={formData.profileImageUrl}
                onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                placeholder="https://images.unsplash.com/..."
              />
            </div>
          </div>

          {/* Interests & Skills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-campus-600" />
              Interests & Skills (Updates Neo4j [:HAS_INTEREST] edges)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-100">
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
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {selected ? `✓ ${interest}` : `+ ${interest}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="md" isLoading={loading} icon={Save}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

