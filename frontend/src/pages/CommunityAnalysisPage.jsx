import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { AlertTriangle, Network, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import api from '../services/api';

const COMMUNITY_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#4f46e5'];

export const CommunityAnalysisPage = () => {
  const graphContainerRef = useRef(null);
  const graphInstanceRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/communities/detect');
      setAnalysis(response.data?.data || null);
      setSelectedCommunityId(null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Community analysis could not be completed. Check the Neo4j connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container || !analysis?.graph) return undefined;
    graphInstanceRef.current?.destroy();

    const communityColors = new Map(
      analysis.communities.map((community, index) => [
        community.communityId,
        COMMUNITY_COLORS[index % COMMUNITY_COLORS.length]
      ])
    );
    const nodes = analysis.graph.nodes.map(node => ({
      data: { id: node.id, label: node.name || node.studentId, communityId: node.communityId }
    }));
    const edges = analysis.graph.edges.map((edge, index) => ({
      data: { id: `friendship-${index}`, source: edge.source, target: edge.target }
    }));

    graphInstanceRef.current = cytoscape({
      container,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': node => communityColors.get(node.data('communityId')) || '#64748b',
            label: 'data(label)',
            color: '#0f172a',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 34,
            height: 34,
            'border-width': 2,
            'border-color': '#ffffff'
          }
        },
        {
          selector: 'edge',
          style: { width: 2, 'line-color': '#cbd5e1', 'curve-style': 'bezier' }
        }
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: 5000, idealEdgeLength: 90 }
    });

    return () => {
      graphInstanceRef.current?.destroy();
      graphInstanceRef.current = null;
    };
  }, [analysis]);

  useEffect(() => {
    if (!graphInstanceRef.current) return;
    graphInstanceRef.current.nodes().forEach(node => {
      node.style('opacity', !selectedCommunityId || node.data('communityId') === selectedCommunityId ? 1 : 0.18);
    });
    graphInstanceRef.current.edges().forEach(edge => {
      const source = edge.source().data('communityId');
      const target = edge.target().data('communityId');
      edge.style('opacity', !selectedCommunityId || (source === selectedCommunityId && target === selectedCommunityId) ? 1 : 0.12);
    });
  }, [selectedCommunityId, analysis]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Network className="h-6 w-6 text-campus-600" />
            Community Analysis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Explore groups inferred from friendships, follows, shared courses, departments, clubs, events, and interests.
          </p>
        </div>
        <Button size="sm" onClick={runAnalysis} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing…' : 'Re-run analysis'}
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Neo4j GDS Louvain is not installed in the configured Neo4j 5.26 Community instance.
          Communities use deterministic label propagation over combined social and shared-campus relationships; this heuristic is not evidence of misconduct.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {analysis && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-3">
              <Users className="h-5 w-5 text-campus-600" />
              <div><p className="text-xs text-slate-500">Communities</p><p className="text-xl font-bold">{analysis.total}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-600" />
              <div><p className="text-xs text-slate-500">Students</p><p className="text-xl font-bold">{analysis.graph.nodes.length}</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3">
              <Network className="h-5 w-5 text-violet-600" />
              <div><p className="text-xs text-slate-500">Friendships</p><p className="text-xl font-bold">{analysis.graph.edges.length}</p></div>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader
                title="Community graph"
                subtitle={`${analysis.algorithmDescription} · ${analysis.iterations} iteration(s)`}
              />
              <div ref={graphContainerRef} className="h-[520px] bg-slate-50" />
            </Card>

            <Card>
              <CardHeader title="Detected communities" subtitle={`Analyzed ${new Date(analysis.detectedAt).toLocaleString()}`} />
              <CardContent className="max-h-[520px] space-y-3 overflow-y-auto">
                {analysis.communities.map((community, index) => (
                  <button
                    key={community.communityId}
                    type="button"
                    onClick={() => setSelectedCommunityId(
                      selectedCommunityId === community.communityId ? null : community.communityId
                    )}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedCommunityId === community.communityId
                        ? 'border-campus-400 bg-campus-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-semibold text-slate-800">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COMMUNITY_COLORS[index % COMMUNITY_COLORS.length] }} />
                        {community.communityLabel}
                      </span>
                      <span className="text-xs text-slate-500">{community.size} members</span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {community.internalEdges} internal friendships · {Math.round(community.density * 100)}% density · {community.cohesion}
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-slate-600">
                      {community.members.map(member => member.name || member.studentId).join(', ')}
                    </span>
                  </button>
                ))}
                {analysis.communities.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">No student communities found.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
