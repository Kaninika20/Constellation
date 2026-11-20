import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { RiskScoreBadge } from '../components/fraud/RiskScoreBadge';
import api from '../services/api';

const STAT_CARDS = [
  ['totalStudents', 'Students', Users],
  ['totalFriendships', 'Friendships', Users],
  ['totalFollows', 'Following', Users],
  ['totalCommunities', 'Communities', ClipboardList],
  ['flaggedAccounts', 'Flagged accounts', ShieldAlert]
];

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboardResponse, flaggedResponse] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/flagged')
      ]);
      setStats(dashboardResponse.data.data);
      setFlagged(flaggedResponse.data.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Admin dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const inspectAccount = async studentId => {
    setError('');
    try {
      const response = await api.get(`/admin/student/${encodeURIComponent(studentId)}/risk`);
      setSelected(response.data.data);
      setNotes('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Account investigation details could not be loaded.');
    }
  };

  const markReviewed = async () => {
    if (!selected) return;
    setSavingReview(true);
    setError('');
    try {
      await api.post(`/admin/student/${encodeURIComponent(selected.student.studentId)}/review`, { notes });
      await inspectAccount(selected.student.studentId);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The account review could not be saved.');
    } finally {
      setSavingReview(false);
    }
  };

  const recalculate = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/analyze', {});
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Risk analysis could not be recalculated.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ShieldAlert className="h-6 w-6 text-campus-600" /> Administrator Investigation
          </h1>
          <p className="mt-1 text-sm text-slate-500">Review explainable graph indicators; a flag is not proof of wrongdoing.</p>
        </div>
        <Button size="sm" onClick={recalculate} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Recalculate risks
        </Button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && !stats && <p className="py-10 text-center text-sm text-slate-500">Loading administrator data…</p>}

      {stats && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {STAT_CARDS.map(([key, label, Icon]) => (
              <Card key={key}><CardContent className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-campus-600" />
                <div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold">{stats[key] ?? 0}</p></div>
              </CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Risk distribution" subtitle="Categories reflect stored rule-based scores and are for review prioritization." />
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {['low', 'medium', 'high'].map(level => {
                const count = stats.riskDistribution?.[level] || 0;
                const total = stats.totalStudents || 0;
                const percent = total ? Math.round((count / total) * 100) : 0;
                const color = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
                return <div key={level} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex justify-between text-sm font-medium capitalize text-slate-700"><span>{level}</span><span>{count} ({percent}%)</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${color}`} style={{ width: `${percent}%` }} /></div>
                </div>;
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
            <Card>
              <CardHeader title="Accounts requiring review" subtitle={`${flagged.length} accounts with recorded indicators`} />
              <CardContent className="max-h-[650px] space-y-2 overflow-y-auto">
                {flagged.map(account => (
                  <button
                    key={account.studentId}
                    type="button"
                    onClick={() => inspectAccount(account.studentId)}
                    className={`w-full rounded-xl border p-3 text-left hover:bg-slate-50 ${selected?.student?.studentId === account.studentId ? 'border-campus-400 bg-campus-50' : 'border-slate-200'}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{account.name || account.studentId}</span><span className="text-xs text-slate-500">{account.department || account.studentId}</span></span>
                      <span className="flex shrink-0 items-center gap-2"><span className="text-[11px] text-slate-500">{account.reviewStatus || 'pending'}</span><RiskScoreBadge score={account.fraudRiskScore} riskLevel={account.riskCategory} /></span>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {(account.riskIndicators || []).map((indicator, index) => <span key={`${index}-${typeof indicator === 'string' ? indicator : indicator.rule}`} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">{typeof indicator === 'string' ? indicator : indicator.description || indicator.label}</span>)}
                    </span>
                  </button>
                ))}
                {!flagged.length && <p className="py-8 text-center text-sm text-slate-500">No accounts have review indicators.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Investigation details" subtitle={selected?.student?.studentId || 'Select a flagged account'} />
              <CardContent className="space-y-4">
                {!selected ? <div className="py-10 text-center text-sm text-slate-500">Select an account to see reasons, connections, and review history.</div> : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="font-semibold text-slate-900">{selected.student.name || selected.student.studentId}</p><p className="text-xs text-slate-500">{selected.student.department} · {selected.reviewStatus}</p></div>
                      <RiskScoreBadge score={selected.computedScore ?? selected.riskScore} riskLevel={selected.riskCategory} />
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                      <p className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Why this account was flagged</p>
                      {(selected.indicatorDetails || []).length
                        ? selected.indicatorDetails.map((indicator, index) => <p key={`${indicator.key}-${index}`}>• {indicator.label}{indicator.detail ? ` — ${indicator.detail}` : ''}</p>)
                        : <p>No current rule indicators were returned. Recalculate analysis to refresh the score.</p>}
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Related accounts</h3>
                      <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
                        {['friends', 'following', 'followers'].map(type => (selected.relatedAccounts?.[type] || []).map(account => (
                          <button key={`${type}-${account.studentId}`} onClick={() => inspectAccount(account.studentId)} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-left hover:bg-slate-100">
                            <span>{account.name || account.studentId} <span className="text-slate-400">· {type}</span></span>
                            <span className="text-slate-500">{account.riskLevel || 'Unscored'}</span>
                          </button>
                        )))}
                        {!Object.values(selected.relatedAccounts || {}).some(accounts => accounts.length) && <p className="text-slate-500">No related accounts found.</p>}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-slate-800">Review history</h3>
                      <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs">
                        {(selected.reviewHistory || []).slice().reverse().map((entry, index) => <div key={`${entry.reviewedAt}-${index}`}><p className="font-medium text-slate-700">{new Date(entry.reviewedAt).toLocaleString()} · {entry.reviewerStudentId}</p><p className="text-slate-500">{entry.notes || 'No note recorded.'}</p></div>)}
                        {!selected.reviewHistory?.length && <p className="text-slate-500">No previous reviews.</p>}
                      </div>
                    </div>
                    <label className="block text-xs font-medium text-slate-600">Investigation note
                      <textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Record the review outcome or context…" />
                    </label>
                    <Button size="sm" onClick={markReviewed} disabled={savingReview}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />{savingReview ? 'Saving…' : 'Mark reviewed'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
