import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  CalendarDays,
  Calendar,
  MapPin,
  Users,
  Plus,
  Minus,
  Check,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const EventsPage = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');

  // Create event modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    date: '',
    location: '',
    description: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Participants modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/events');
      if (res.data?.data) {
        setEvents(res.data.data);
      }
    } catch (err) {
      console.warn('[EventsPage] Using fallback events data');
      setEvents([
        {
          eventId: 'EVT_HACK26',
          title: 'Campus Hackathon 2026',
          date: '2026-11-20',
          location: 'Science & Tech Auditorium',
          description: '36-hour multi-track graph and AI challenge with industry judges.',
          participantCount: 42,
          isRegistered: true
        },
        {
          eventId: 'EVT_GRAPH_WS',
          title: 'Neo4j Graph Database Workshop',
          date: '2026-11-25',
          location: 'Lab CS-301',
          description: 'Hands-on Cypher querying, graph property data modeling, and performance indexing.',
          participantCount: 28,
          isRegistered: true
        },
        {
          eventId: 'EVT_CYBER_CTF',
          title: 'Inter-College CTF & Fraud Defense',
          date: '2026-12-05',
          location: 'Virtual Arena',
          description: 'Defending social graphs against sybil attacks, bot rings, and identity spoofing.',
          participantCount: 35,
          isRegistered: false
        },
        {
          eventId: 'EVT_ALUMNI_CON',
          title: 'Tech Career & Alumni Connect',
          date: '2026-12-12',
          location: 'Campus Convention Center',
          description: 'Mentorship and technical career networking with university alumni engineers.',
          participantCount: 50,
          isRegistered: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRegister = async (eventId) => {
    setActionLoading(`reg_${eventId}`);
    setMessage('');
    try {
      await api.post(`/events/${eventId}/register`);
      setMessage('Successfully registered for event!');
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to register');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (eventId) => {
    if (!window.confirm('Are you sure you want to cancel your event registration?')) return;
    setActionLoading(`cancel_${eventId}`);
    setMessage('');
    try {
      await api.post(`/events/${eventId}/cancel`);
      setMessage('Registration cancelled.');
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      await api.post('/events', createForm);
      setMessage('New college event created successfully in Neo4j!');
      setIsCreateModalOpen(false);
      setCreateForm({ title: '', date: '', location: '', description: '' });
      fetchEvents();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewParticipants = async (event) => {
    setSelectedEvent(event);
    setLoadingParticipants(true);
    try {
      const res = await api.get(`/events/${event.eventId}/participants`);
      if (res.data?.data) {
        setParticipants(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load participants');
      setParticipants([]);
    } finally {
      setLoadingParticipants(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-500" />
            Campus Events & Hackathons
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Discover technical workshops, competitions, and conferences linked via Neo4j [:PARTICIPATES_IN]
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={Plus}
          >
            Create Event
          </Button>

          <button
            onClick={fetchEvents}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-amber-500 hover:text-amber-800">✕</button>
        </div>
      )}

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {events.map((event) => (
          <Card key={event.eventId} hover className="p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {event.date}
                </span>
                {event.isRegistered && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Registered
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-slate-900 leading-snug">{event.title}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{event.description}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {event.location}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong className="text-slate-800">{event.participantCount || 0}</strong> Attending
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewParticipants(event)}
                className="text-xs"
              >
                View Attendees
              </Button>

              {event.isRegistered ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(event.eventId)}
                  isLoading={actionLoading === `cancel_${event.eventId}`}
                  className="text-xs text-red-600 hover:bg-red-50"
                  icon={Minus}
                >
                  Cancel Attendance
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleRegister(event.eventId)}
                  isLoading={actionLoading === `reg_${event.eventId}`}
                  className="text-xs"
                  icon={Check}
                >
                  Register
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h4 className="font-bold text-slate-900 text-sm">Create College Event Node</h4>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graph Theory & Neo4j Symposium"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Venue</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auditorium Hall B"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Briefly describe the schedule, prerequisites, and keynote speakers..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-campus-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={createLoading}>
                  Publish Event
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participants Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {selectedEvent.title}
                </h4>
                <p className="text-xs text-slate-500">Registered Participants ([:PARTICIPATES_IN])</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {loadingParticipants ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading attendees from Neo4j...</div>
              ) : participants.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">No students registered yet. Be the first!</div>
              ) : (
                participants.map(({ student, status }, idx) => (
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
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Confirmed
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

