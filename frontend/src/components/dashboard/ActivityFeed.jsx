import React from 'react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { UserPlus, BookOpen, Calendar, ShieldCheck, HeartHandshake } from 'lucide-react';

const mockActivities = [
  {
    id: 1,
    icon: UserPlus,
    color: 'bg-blue-100 text-blue-600',
    title: 'New Connection Formed',
    desc: 'Priya Patel and Aarav Sharma became FRIENDS_WITH.',
    time: '12m ago'
  },
  {
    id: 2,
    icon: BookOpen,
    color: 'bg-emerald-100 text-emerald-600',
    title: 'Course Enrollment',
    desc: 'Rohan Gupta enrolled in CYB304 (STUDIES).',
    time: '1h ago'
  },
  {
    id: 3,
    icon: Calendar,
    color: 'bg-amber-100 text-amber-600',
    title: 'Event Registration',
    desc: '42 students joined Neo4j Graph Database Workshop (PARTICIPATES_IN).',
    time: '2h ago'
  },
  {
    id: 4,
    icon: ShieldCheck,
    color: 'bg-purple-100 text-purple-600',
    title: 'Graph Integrity Check',
    desc: 'Sybil anomaly detection engine scanned 1,420 edges without fraud alarms.',
    time: '4h ago'
  }
];

export const ActivityFeed = () => {
  return (
    <Card>
      <CardHeader
        title="Live Graph Activity"
        subtitle="Recent edge creations and network occurrences"
      />
      <CardContent className="space-y-4">
        {mockActivities.map((act) => {
          const Icon = act.icon;
          return (
            <div key={act.id} className="flex items-start gap-3.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${act.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-800">{act.title}</p>
                  <span className="text-[11px] text-slate-400">{act.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{act.desc}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

