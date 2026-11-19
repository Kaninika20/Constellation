import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { UserPlus, Sparkles, Check } from 'lucide-react';
import api from '../../services/api';
import { Link } from 'react-router-dom';

export const SuggestedConnections = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentMap, setSentMap] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    const fetchPeers = async () => {
      try {
        const res = await api.get('/students?limit=4');
        if (res.data?.data?.students) {
          setStudents(res.data.data.students);
        }
      } catch (err) {
        // Fallback demo peers
        setStudents([
          {
            studentId: 'STU2026002',
            name: 'Priya Patel',
            department: 'Data Science',
            yearOfStudy: 4,
            interests: ['Graph Mining', 'AI'],
            profileImageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
          },
          {
            studentId: 'STU2026003',
            name: 'Rohan Gupta',
            department: 'Cybersecurity',
            yearOfStudy: 3,
            interests: ['Fraud Detection'],
            profileImageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150'
          },
          {
            studentId: 'STU2026004',
            name: 'Ananya Deshmukh',
            department: 'Computer Science',
            yearOfStudy: 2,
            interests: ['UI/UX', 'React'],
            profileImageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPeers();
  }, []);

  const handleSendRequest = async (targetId) => {
    setLoadingId(targetId);
    try {
      await api.post('/relationships/friend-requests', { targetStudentId: targetId });
      setSentMap(prev => ({ ...prev, [targetId]: true }));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not send friend request');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Suggested Graph Peers"
        subtitle="Shared courses, clubs, and academic interests"
        action={
          <span className="flex items-center gap-1 text-[11px] font-semibold text-campus-600">
            <Sparkles className="w-3.5 h-3.5" /> Jaccard Similarity
          </span>
        }
      />
      <CardContent className="space-y-3.5">
        {students.map((peer) => {
          const isSent = sentMap[peer.studentId];
          return (
            <div key={peer.studentId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={peer.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peer.name}`}
                  alt={peer.name}
                  className="w-10 h-10 rounded-2xl object-cover border border-slate-200"
                />
                <div className="min-w-0">
                  <Link to={`/profile/${peer.studentId}`} className="text-xs font-semibold text-slate-800 hover:text-campus-600 truncate block">
                    {peer.name}
                  </Link>
                  <p className="text-[11px] text-slate-500 truncate">
                    {peer.department} • Year {peer.yearOfStudy}
                  </p>
                  {peer.interests && peer.interests.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {peer.interests.slice(0, 2).map((item, idx) => (
                        <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          #{item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isSent ? (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 shrink-0 px-2 py-1 bg-emerald-50 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Sent
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendRequest(peer.studentId)}
                  isLoading={loadingId === peer.studentId}
                  className="text-xs shrink-0"
                  icon={UserPlus}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
