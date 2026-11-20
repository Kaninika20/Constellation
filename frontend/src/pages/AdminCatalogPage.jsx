import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, RefreshCw, Users2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import api from '../services/api';

const FIELD_CLASS = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-campus-500 focus:outline-none';

const FormField = ({ name, label, type = 'text', required = false, ...props }) => (
  <label htmlFor={`catalog-${name}`} className="block text-xs font-semibold text-slate-700">
    {label}{required && <span className="text-red-500"> *</span>}
    <input
      id={`catalog-${name}`}
      name={name}
      type={type}
      required={required}
      className={FIELD_CLASS}
      {...props}
    />
  </label>
);

const FormTextArea = ({ name, label, ...props }) => (
  <label htmlFor={`catalog-${name}`} className="block text-xs font-semibold text-slate-700">
    {label}
    <textarea
      id={`catalog-${name}`}
      name={name}
      rows={3}
      className={`${FIELD_CLASS} resize-y`}
      {...props}
    />
  </label>
);

const CATALOG_TABS = [
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'clubs', label: 'Clubs', icon: Users2 },
  { id: 'events', label: 'Events', icon: CalendarDays }
];

const EMPTY_CATALOG = { courses: [], clubs: [], events: [] };

export const AdminCatalogPage = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setCatalogError('');
    try {
      const [coursesResponse, clubsResponse, eventsResponse] = await Promise.all([
        api.get('/courses'),
        api.get('/clubs'),
        api.get('/events')
      ]);
      const courses = coursesResponse.data?.data;
      const clubs = clubsResponse.data?.data;
      const events = eventsResponse.data?.data;
      if (!Array.isArray(courses) || !Array.isArray(clubs) || !Array.isArray(events)) {
        throw new Error('The catalog response was invalid.');
      }
      setCatalog({ courses, clubs, events });
    } catch (error) {
      setCatalogError(error.response?.data?.message || error.message || 'Could not load the campus catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleCreate = kind => async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setSaving(true);
    setFeedback(null);

    const endpoints = {
      courses: { url: '/admin/courses', success: 'Course added or updated.' },
      clubs: { url: '/admin/clubs', success: 'Club added or updated.' },
      events: { url: '/admin/events', success: 'Event created.' }
    };

    try {
      await api.post(endpoints[kind].url, values);
      form.reset();
      setFeedback({ type: 'success', text: endpoints[kind].success });
      await loadCatalog();
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || `Could not save this ${kind.slice(0, -1)}.`
      });
    } finally {
      setSaving(false);
    }
  };

  const currentTab = CATALOG_TABS.find(tab => tab.id === activeTab);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campus Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add courses, clubs, and events for students to discover. Course departments provide subject grouping.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadCatalog} disabled={loading} icon={RefreshCw}>
          Refresh catalog
        </Button>
      </header>

      <div role="tablist" aria-label="Catalog types" className="flex flex-wrap gap-2">
        {CATALOG_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`catalog-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls="catalog-panel"
            onClick={() => {
              setActiveTab(id);
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
              activeTab === id
                ? 'border-campus-600 bg-campus-50 text-campus-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
              {catalog[id].length}
            </span>
          </button>
        ))}
      </div>

      {catalogError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {catalogError}
        </div>
      )}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div id="catalog-panel" role="tabpanel" aria-labelledby={`catalog-tab-${activeTab}`} className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={activeTab === 'events' ? 'Create event' : `Add or update ${activeTab.slice(0, -1)}`}
            subtitle={
              activeTab === 'courses'
                ? 'Saving an existing course code updates that course.'
                : activeTab === 'clubs'
                  ? 'Saving an existing club ID updates that club.'
                  : 'Add an event for students to view and join.'
            }
          />
          <CardContent>
            {activeTab === 'courses' && (
              <form className="space-y-4" onSubmit={handleCreate('courses')}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField name="courseCode" label="Course code" placeholder="e.g. CS401" required maxLength={32} />
                  <FormField name="courseName" label="Course name" placeholder="e.g. Advanced Graph Systems" required maxLength={120} />
                  <FormField name="department" label="Department / subject" placeholder="e.g. Computer Science" required maxLength={80} />
                  <FormField name="credits" label="Credits" type="number" min="0" max="30" step="1" defaultValue="3" />
                </div>
                <Button type="submit" size="sm" isLoading={saving}>Save course</Button>
              </form>
            )}

            {activeTab === 'clubs' && (
              <form className="space-y-4" onSubmit={handleCreate('clubs')}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField name="clubId" label="Club ID" placeholder="e.g. CLUB_ROBOTICS" required maxLength={40} />
                  <FormField name="name" label="Club name" placeholder="e.g. Robotics Society" required maxLength={120} />
                  <FormField name="category" label="Category" placeholder="e.g. Engineering" required maxLength={80} />
                </div>
                <FormTextArea name="description" label="Description" maxLength={1000} />
                <Button type="submit" size="sm" isLoading={saving}>Save club</Button>
              </form>
            )}

            {activeTab === 'events' && (
              <form className="space-y-4" onSubmit={handleCreate('events')}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField name="title" label="Event title" placeholder="e.g. Campus Research Expo" required maxLength={160} />
                  <FormField name="date" label="Date" type="date" required />
                  <FormField name="location" label="Location" placeholder="e.g. Science Auditorium" required maxLength={160} />
                  <FormField name="category" label="Category" placeholder="e.g. Workshop" maxLength={80} />
                  <FormField name="eventId" label="Event ID (optional)" placeholder="Generated if left blank" maxLength={40} />
                </div>
                <FormTextArea name="description" label="Description" maxLength={1000} />
                <Button type="submit" size="sm" isLoading={saving}>Create event</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={`Existing ${currentTab.label.toLowerCase()}`}
            subtitle={`${catalog[activeTab].length} catalog ${catalog[activeTab].length === 1 ? 'entry' : 'entries'}`}
          />
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading catalog…</p>
            ) : catalog[activeTab].length === 0 ? (
              <p className="text-sm text-slate-500">No {currentTab.label.toLowerCase()} are available yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeTab === 'courses' && catalog.courses.map(course => (
                  <li key={course.courseCode} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-slate-900">{course.courseName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {course.courseCode} · {course.department} · {course.credits ?? 0} credits · {course.studentCount ?? 0} enrolled
                    </p>
                  </li>
                ))}
                {activeTab === 'clubs' && catalog.clubs.map(club => (
                  <li key={club.clubId} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-slate-900">{club.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {club.clubId} · {club.category} · {club.memberCount ?? 0} members
                    </p>
                  </li>
                ))}
                {activeTab === 'events' && catalog.events.map(event => (
                  <li key={event.eventId} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.date} · {event.location}{event.category ? ` · ${event.category}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
