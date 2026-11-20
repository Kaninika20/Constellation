import React, { useMemo, useState } from 'react';
import { RefreshCw, Search, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../hooks/useStudents';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card, CardContent, CardHeader } from '../components/common/Card';
import api from '../services/api';

export const AdminAccessPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { students, loading, error: loadError, refresh } = useStudents();
  const [search, setSearch] = useState('');
  const [roleOverrides, setRoleOverrides] = useState({});
  const [busyStudentId, setBusyStudentId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const studentsWithRoles = useMemo(() => students.map(student => ({
    ...student,
    role: roleOverrides[student.studentId] ?? student.role ?? 'student'
  })), [students, roleOverrides]);
  const adminCount = studentsWithRoles.filter(student => student.role === 'admin').length;
  const filteredStudents = studentsWithRoles
    .filter(student => `${student.name || ''} ${student.studentId || ''} ${student.email || ''}`
      .toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) =>
      Number(b.role === 'admin') - Number(a.role === 'admin') ||
      (a.name || a.studentId).localeCompare(b.name || b.studentId)
    );

  const changeRole = async student => {
    const nextRole = student.role === 'admin' ? 'student' : 'admin';
    if (nextRole === 'student' && adminCount <= 1) return;

    const isSelfDemotion = student.studentId === user?.studentId && nextRole === 'student';
    const prompt = nextRole === 'admin'
      ? `Grant administrator access to ${student.name || student.studentId}?`
      : `Remove administrator access from ${student.name || student.studentId}?${isSelfDemotion ? ' You will be signed out.' : ''}`;
    if (!window.confirm(prompt)) return;

    setError('');
    setMessage('');
    setBusyStudentId(student.studentId);
    try {
      const response = await api.patch(`/admin/students/${encodeURIComponent(student.studentId)}/role`, {
        role: nextRole
      });
      setRoleOverrides(previous => ({ ...previous, [student.studentId]: nextRole }));
      setMessage(response.data?.message || 'Administrator access updated.');
      if (isSelfDemotion) {
        logout();
        navigate('/login', { replace: true });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Administrator access could not be updated.');
    } finally {
      setBusyStudentId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Shield className="h-6 w-6 text-campus-600" /> Administrator Access
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Appoint a successor or revoke administrator access. At least one administrator must remain.
          </p>
        </div>
        <Button size="sm" variant="outline" icon={RefreshCw} onClick={refresh} disabled={loading}>
          Refresh students
        </Button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Administrator profiles are publicly followable; following is immediate and does not require approval.
        Promote a successor before removing your own access.
      </div>

      {(error || loadError) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || loadError}
        </div>
      )}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <Card>
        <CardHeader
          title="Student roles"
          subtitle={`${adminCount} administrator${adminCount === 1 ? '' : 's'} currently have access.`}
        />
        <CardContent>
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, student ID, or email"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          {loading && students.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Loading students…</p>}
          {!loading && filteredStudents.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No students match your search.</p>}

          <div className="divide-y divide-slate-100">
            {filteredStudents.map(student => {
              const isAdmin = student.role === 'admin';
              const isLastAdmin = isAdmin && adminCount <= 1;
              return (
                <div key={student.studentId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-800">{student.name || 'Unnamed student'}</p>
                      {isAdmin && <Badge color="purple">Admin</Badge>}
                      {student.studentId === user?.studentId && <Badge color="slate">You</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {student.studentId}{student.email ? ` · ${student.email}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdmin ? 'danger' : 'outline'}
                    icon={isAdmin ? ShieldOff : ShieldCheck}
                    disabled={busyStudentId === student.studentId || isLastAdmin}
                    isLoading={busyStudentId === student.studentId}
                    title={isLastAdmin ? 'Promote a successor before removing the final administrator.' : undefined}
                    onClick={() => changeRole(student)}
                  >
                    {isAdmin ? (student.studentId === user?.studentId ? 'Remove my access' : 'Remove admin') : 'Make admin'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
