import React, { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, User, Search } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { RiskScoreBadge } from '../components/fraud/RiskScoreBadge';
import api from '../services/api';

const DEFAULT_RISK_CONFIG = {
  highFriendCount: 30,
  highFriendPoints: 25,
  rapidFriendCount: 5,
  rapidWindowHours: 24,
  rapidGrowthPoints: 30,
  coordinatedGroupMinSize: 4,
  coordinatedDensityThreshold: 0.75,
  coordinatedInactivityRatio: 0.75,
  coordinatedGroupPoints: 25,
  fewFriendMaxCount: 1,
  fewConnectionsPoints: 15,
  minAccountAgeDays: 7,
  unusualMinFriendCount: 8,
  unusualMaxClustering: 0.1,
  unusualMaxReciprocity: 0.2,
  unusualRelationshipPoints: 25,
  mediumRiskThreshold: 30,
  highRiskThreshold: 60,
};

const TABS = [
  { id: 'risk-scores', label: 'Rule Analysis' },
  { id: 'sybil', label: 'Sybil Candidates' },
  { id: 'cliques', label: 'Suspicious Cliques' },
  { id: 'path-finder', label: 'Path Finder' },
];

const buildAnomalyIndicators = (s) => {
  const tags = [];
  if (s.courseCount === 0) tags.push('No courses');
  if (s.clubCount === 0) tags.push('No clubs');
  if (s.followingCount > 0) tags.push(`Following ${s.followingCount} accounts`);
  return tags;
};

export const FraudRadarPage = () => {
  const [activeTab, setActiveTab] = useState('risk-scores');
  const [highRiskStudents, setHighRiskStudents] = useState([]);
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [riskConfig, setRiskConfig] = useState(DEFAULT_RISK_CONFIG);
  const [sybilCandidates, setSybilCandidates] = useState([]);
  const [suspiciousCliques, setSuspiciousCliques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  const [pathStudentA, setPathStudentA] = useState('');
  const [pathStudentB, setPathStudentB] = useState('');
  const [pathResult, setPathResult] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const [analysisRes, sybilRes, cliqueRes] = await Promise.allSettled([
      api.get('/fraud/analysis'),
      api.get('/fraud/sybil-candidates'),
      api.get('/fraud/suspicious-cliques'),
    ]);

    let anyOffline = false;

    if (analysisRes.status === 'fulfilled') {
      const analysis = analysisRes.value.data?.data || analysisRes.value.data;
      setRiskAnalysis(analysis);
      setRiskConfig(analysis.config || DEFAULT_RISK_CONFIG);
      setHighRiskStudents((analysis.students || []).filter(student => student.riskScore > 0));
    } else {
      anyOffline = true;
      setRiskAnalysis(null);
      setHighRiskStudents([]);
    }

    if (sybilRes.status === 'fulfilled') {
      const raw = sybilRes.value.data?.data || sybilRes.value.data || [];
      setSybilCandidates(raw.map(s => ({
        ...s,
        anomalyIndicators: s.anomalyIndicators || buildAnomalyIndicators(s),
      })));
    } else {
      anyOffline = true;
      setSybilCandidates([]);
    }

    if (cliqueRes.status === 'fulfilled') {
      setSuspiciousCliques(cliqueRes.value.data?.data || cliqueRes.value.data || []);
    } else {
      anyOffline = true;
      setSuspiciousCliques([]);
    }

    setOffline(anyOffline);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setAnalysisError('');
    try {
      await api.post('/fraud/analyze', { config: riskConfig });
      await fetchAll();
    } catch (e) {
      setAnalysisError(e.response?.data?.message || 'Analysis failed. Check the configuration and Neo4j connection.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleFindPath = async () => {
    if (!pathStudentA.trim() || !pathStudentB.trim()) return;
    setPathLoading(true);
    setPathError('');
    setPathResult(null);
    try {
      const res = await api.get(`/fraud/path/${encodeURIComponent(pathStudentA.trim())}/${encodeURIComponent(pathStudentB.trim())}`);
      setPathResult(res.data?.data || res.data);
    } catch (e) {
      const status = e.response?.status;
      if (status === 503 || !status) {
        setPathError('Neo4j is currently offline. Path finder requires a live database connection.');
      } else {
        setPathError(e.response?.data?.message || 'Could not find a path between these students.');
      }
    } finally {
      setPathLoading(false);
    }
  };

  const totalFlagged = highRiskStudents.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fraud Radar</h1>
            <p className="text-xs text-slate-500">Explainable graph indicators for human review — not proof of wrongdoing</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            {riskAnalysis?.riskLevelCounts?.High || 0} High risk
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Analyzing…' : 'Analyze Network'}
          </Button>
        </div>
      </div>

      {/* Offline Warning */}
      {offline && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Analysis unavailable — no synthetic accounts are shown.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40 text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Tab 1: Risk Scores */}
          {activeTab === 'risk-scores' && (
            <Card>
              <CardHeader
                title="Accounts with review indicators"
                subtitle={riskAnalysis?.analyzedAt
                  ? `${totalFlagged} accounts with indicators · analyzed ${new Date(riskAnalysis.analyzedAt).toLocaleString()}`
                  : 'Run an analysis to calculate explainable rule-based scores.'}
              />
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                  Risk categories prioritize manual review only. A score or indicator is not evidence that an account is fraudulent,
                  and no account is automatically restricted.
                </div>
                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">Configure rule thresholds</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ['highFriendCount', 'High friendship count'],
                      ['rapidFriendCount', 'Recent friendships threshold'],
                      ['rapidWindowHours', 'Rapid-growth window (hours)'],
                      ['coordinatedGroupMinSize', 'Dense-group minimum size'],
                      ['mediumRiskThreshold', 'Medium score threshold'],
                      ['highRiskThreshold', 'High score threshold'],
                    ].map(([key, label]) => (
                      <label key={key} className="text-xs font-medium text-slate-600">
                        {label}
                        <input
                          type="number"
                          min="0"
                          value={riskConfig[key]}
                          onChange={event => setRiskConfig(config => ({
                            ...config,
                            [key]: event.target.value === '' ? '' : Number(event.target.value),
                          }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </details>
                {analysisError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{analysisError}</div>
                )}
                {highRiskStudents.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">
                    {riskAnalysis?.analyzedAt ? 'No accounts with rule indicators were returned.' : 'No analysis has been run yet.'}
                  </p>
                ) : (
                  highRiskStudents.map(s => (
                    <div
                      key={s.studentId}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        s.riskLevel === 'High'
                          ? 'bg-red-50 border-red-100'
                          : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${s.fraudRiskScore >= 0.75 ? 'text-red-800' : 'text-slate-800'}`}>
                            {s.name || s.studentId}
                          </p>
                          <p className="text-xs text-slate-500">{s.department}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            Score {s.riskScore}/100 · {s.friendCount} friends · {s.recentFriendships} recent
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(s.riskIndicators || []).map((indicator, index) => (
                              <span key={`${indicator.rule}-${index}`} title={`${indicator.points} points`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                {indicator.description}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <RiskScoreBadge score={s.fraudRiskScore} riskLevel={s.riskLevel} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab 2: Sybil Candidates */}
          {activeTab === 'sybil' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <strong>What is a Sybil account?</strong> A Sybil account is a fake identity that mimics a real student
                profile. They typically have zero academic engagement (no courses, no clubs) but exhibit unusual
                follow behaviors — inflating social metrics while contributing nothing to campus communities.
              </div>
              <Card>
                <CardHeader title="Sybil Candidates" subtitle="Accounts with suspicious social-to-academic ratios" />
                <CardContent className="space-y-3">
                  {sybilCandidates.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-6">No sybil candidates detected.</p>
                  ) : (
                    sybilCandidates.map(s => (
                      <div key={s.studentId} className="p-3 rounded-xl border bg-slate-50 border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                            <span className="text-xs text-slate-400">{s.department}</span>
                          </div>
                          <RiskScoreBadge score={s.fraudRiskScore ?? 0} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(s.anomalyIndicators || buildAnomalyIndicators(s)).map((tag, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tab 3: Suspicious Cliques */}
          {activeTab === 'cliques' && (
            <Card>
              <CardHeader title="Suspicious Cliques" subtitle="Dense clusters with anomalous interaction patterns" />
              <CardContent className="space-y-3">
                {suspiciousCliques.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No suspicious cliques detected.</p>
                ) : (
                  suspiciousCliques.map((c, i) => (
                    <div key={c.studentId || i} className="flex items-start gap-3 p-3 rounded-xl border bg-orange-50 border-orange-100">
                      <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-orange-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 font-medium">
                            {c.degree} connections
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{c.reason}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Tab 4: Path Finder */}
          {activeTab === 'path-finder' && (
            <Card>
              <CardHeader
                title="Shortest Path Finder"
                subtitle="Discover connection chains between any two students in the graph"
              />
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Student ID A</label>
                    <input
                      type="text"
                      value={pathStudentA}
                      onChange={e => setPathStudentA(e.target.value)}
                      placeholder="e.g. STU001"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-campus-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Student ID B</label>
                    <input
                      type="text"
                      value={pathStudentB}
                      onChange={e => setPathStudentB(e.target.value)}
                      placeholder="e.g. STU004"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-campus-400"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleFindPath}
                  disabled={pathLoading || !pathStudentA.trim() || !pathStudentB.trim()}
                >
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                  {pathLoading ? 'Searching…' : 'Find Path'}
                </Button>

                {pathError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {pathError}
                  </div>
                )}

                {pathResult && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                    <p className="text-sm font-semibold text-green-800 mb-3">
                      Path found — distance: <strong>{pathResult.distance ?? pathResult.path?.length - 1 ?? '?'}</strong> hops
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(pathResult.path || []).map((node, i) => (
                        <React.Fragment key={i}>
                          <span className="px-3 py-1 rounded-full bg-white border border-green-300 text-green-800 text-xs font-medium shadow-sm">
                            {node.name || node}
                          </span>
                          {i < (pathResult.path.length - 1) && (
                            <span className="text-green-400 text-xs">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
