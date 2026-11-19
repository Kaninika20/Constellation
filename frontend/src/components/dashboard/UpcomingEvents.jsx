import React from 'react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Calendar, MapPin, Users } from 'lucide-react';

const mockEvents = [
  {
    id: 'EVT_HACK26',
    title: 'Campus Hackathon 2026',
    date: 'Nov 20, 2026',
    location: 'Science Auditorium',
    attendees: 128,
    category: 'Competition'
  },
  {
    id: 'EVT_GRAPH_WS',
    title: 'Neo4j Graph Database Workshop',
    date: 'Nov 25, 2026',
    location: 'Lab CS-301',
    attendees: 45,
    category: 'Workshop'
  },
  {
    id: 'EVT_CYBER_CTF',
    title: 'Inter-College Fraud Defense CTF',
    date: 'Dec 05, 2026',
    location: 'Virtual Arena',
    attendees: 80,
    category: 'Security'
  }
];

export const UpcomingEvents = () => {
  return (
    <Card>
      <CardHeader
        title="Campus Graph Events"
        subtitle="Participate and expand your academic subgraph"
      />
      <CardContent className="space-y-3.5">
        {mockEvents.map((event) => (
          <div key={event.id} className="p-3 rounded-xl border border-slate-100 hover:border-campus-200 transition-all bg-slate-50/50">
            <div className="flex items-start justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-800">{event.title}</h5>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-campus-100 text-campus-700">
                {event.category}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {event.date}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {event.location}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" /> {event.attendees}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

