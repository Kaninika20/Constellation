import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { AlertTriangle, Network, RotateCcw, Search, ShieldAlert, ZoomIn, ZoomOut } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NODE_TYPES = ['Student', 'Course', 'Club', 'Event', 'Interest'];
const RELATIONSHIPS = ['FRIENDS_WITH', 'FOLLOWS', 'STUDIES', 'MEMBER_OF', 'PARTICIPATES_IN', 'HAS_INTEREST'];
const TYPE_COLORS = { Student: '#2563eb', Course: '#10b981', Club: '#8b5cf6', Event: '#f59e0b', Interest: '#ec4899' };
const COMMUNITY_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2', '#ca8a04', '#4f46e5'];

export const NetworkPage = () => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const { user } = useAuth();
  const [elements, setElements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [nodeFilters, setNodeFilters] = useState(Object.fromEntries(NODE_TYPES.map(type => [type, true])));
  const [relationshipFilters, setRelationshipFilters] = useState(Object.fromEntries(RELATIONSHIPS.map(type => [type, true])));
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [communityFilter, setCommunityFilter] = useState('All');
  const [communities, setCommunities] = useState([]);
  const [pathStart, setPathStart] = useState('');
  const [pathEnd, setPathEnd] = useState('');
  const [pathMessage, setPathMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGraph = async () => {
    setLoading(true);
    setError('');
    try {
      const graphEndpoint = user?.role === 'admin' ? '/admin/graph?limit=5000' : '/students/network/overview?limit=5000';
      const response = await api.get(graphEndpoint);
      setElements([
        ...(response.data?.data?.elements?.nodes || []),
        ...(response.data?.data?.elements?.edges || [])
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Graph data could not be loaded from the backend.');
      setElements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGraph(); }, [user?.role]);

  const nodes = useMemo(() => elements.filter(element => !element.data.source), [elements]);
  const students = useMemo(() => nodes.filter(node => node.data.type === 'Student'), [nodes]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setCommunities([]);
      return;
    }
    let active = true;
    api.post('/communities/detect')
      .then(response => {
        if (active) {
          setCommunities(response.data?.data?.communities || []);
          loadGraph();
        }
      })
      .catch(() => {
        if (active) setError('Community highlighting is unavailable until community detection succeeds.');
      });
    return () => { active = false; };
  }, [user?.role]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading) return undefined;
    cyRef.current?.destroy();

    const query = search.trim().toLowerCase();
    const visibleNodes = nodes.filter(({ data }) => {
      if (!nodeFilters[data.type]) return false;
      if (query && data.type === 'Student' && !`${data.label} ${data.studentId} ${data.department}`.toLowerCase().includes(query)) return false;
      if (riskFilter !== 'All' && data.type === 'Student' && (data.riskLevel || 'Low') !== riskFilter) return false;
      if (communityFilter !== 'All' && data.type === 'Student' && data.communityId !== communityFilter) return false;
      return true;
    });
    const visibleIds = new Set(visibleNodes.map(node => node.data.id));
    const visibleEdges = elements.filter(({ data }) => data.source &&
      relationshipFilters[data.label] && visibleIds.has(data.source) && visibleIds.has(data.target));
    const communityColors = new Map(communities.map((community, index) => [
      community.communityId,
      COMMUNITY_COLORS[index % COMMUNITY_COLORS.length]
    ]));

    cyRef.current = cytoscape({
      container,
      elements: [...visibleNodes, ...visibleEdges],
      minZoom: 0.1,
      maxZoom: 4,
      style: [
        { selector: 'node', style: {
          'background-color': node => communityColors.get(node.data('communityId')) || TYPE_COLORS[node.data('type')] || '#64748b',
          label: 'data(label)', color: '#0f172a', 'font-size': '10px', 'font-weight': 600,
          'text-valign': 'bottom', 'text-margin-y': 6, width: 36, height: 36,
          'border-width': 2, 'border-color': '#fff', 'text-wrap': 'wrap', 'text-max-width': 100
        } },
        { selector: 'node[type = "Course"]', style: { shape: 'round-rectangle', width: 48, height: 36 } },
        { selector: 'node[type = "Club"]', style: { shape: 'diamond' } },
        { selector: 'node[type = "Event"]', style: { shape: 'triangle' } },
        { selector: 'node[type = "Interest"]', style: { shape: 'hexagon' } },
        { selector: 'node[riskLevel = "Medium"]', style: { 'border-width': 4, 'border-color': '#f59e0b' } },
        { selector: 'node[riskLevel = "High"]', style: { 'background-color': '#dc2626', 'border-width': 4, 'border-color': '#fecaca' } },
        { selector: 'edge', style: {
          width: 2, 'line-color': '#cbd5e1', 'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)',
          'font-size': '7px', color: '#64748b', 'text-rotation': 'autorotate'
        } },
        { selector: 'edge[label = "FRIENDS_WITH"]', style: { 'line-color': '#60a5fa', 'target-arrow-shape': 'none' } },
        { selector: 'edge[label = "FOLLOWS"]', style: { 'line-style': 'dashed', 'line-color': '#f87171' } },
        { selector: '.connected', style: { 'border-color': '#06b6d4', 'border-width': 5 } },
        { selector: '.path-node', style: { 'border-color': '#f97316', 'border-width': 6 } },
        { selector: '.path-edge', style: { width: 6, 'line-color': '#f97316', 'target-arrow-color': '#f97316', opacity: 1 } },
        { selector: '.faded', style: { opacity: 0.12 } },
        { selector: ':selected', style: { 'border-width': 5, 'border-color': '#0f172a' } }
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: 5000, idealEdgeLength: 90 },
      userPanningEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false
    });
    cyRef.current.on('tap', 'node', event => {
      const node = event.target;
      setSelected({ kind: 'node', data: node.data() });
      cyRef.current.elements().removeClass('connected');
      node.closedNeighborhood().addClass('connected');
    });
    cyRef.current.on('tap', 'edge', event => setSelected({ kind: 'relationship', data: event.target.data() }));
    cyRef.current.on('tap', event => {
      if (event.target === cyRef.current) {
        setSelected(null);
        cyRef.current.elements().removeClass('connected path-node path-edge faded');
      }
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [elements, loading, nodeFilters, relationshipFilters, search, riskFilter, communityFilter, communities]);

  const findShortestPath = async () => {
    if (!pathStart || !pathEnd) return;
    setPathMessage('');
    try {
      const response = await api.get(`/fraud/path/${encodeURIComponent(pathStart)}/${encodeURIComponent(pathEnd)}`);
      const result = response.data?.data;
      const ids = (result?.path || []).map(node => typeof node === 'string' ? node : node.studentId).filter(Boolean);
      if (result?.distance < 0 || !ids.length) {
        setPathMessage(result?.message || 'No connection found.');
        return;
      }
      const cy = cyRef.current;
      cy.elements().removeClass('path-node path-edge faded');
      cy.elements().addClass('faded');
      const pathNodes = ids.map(id => cy.getElementById(id)).filter(node => node.length);
      pathNodes.forEach(node => node.removeClass('faded').addClass('path-node'));
      for (let index = 0; index < pathNodes.length - 1; index++) {
        const edge = pathNodes[index].edgesWith(pathNodes[index + 1]);
        edge.removeClass('faded').addClass('path-edge');
      }
      if (pathNodes.length) cy.fit(pathNodes, 60);
      setPathMessage(`Path found: ${ids.join(' → ')} (${result.distance} hops)`);
    } catch (requestError) {
      setPathMessage(requestError.response?.data?.message || 'Could not calculate the connection path.');
    }
  };

  const toggle = (setter, type) => setter(current => ({ ...current, [type]: !current[type] }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Network className="h-6 w-6 text-campus-600" />Campus Graph Explorer</h1>
        <p className="mt-1 text-xs text-slate-500">Interactive Cytoscape visualization loaded through the backend API.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card><CardHeader title="Find and filter" subtitle={`${nodes.length} nodes · ${elements.length - nodes.length} relationships`} /><CardContent className="space-y-3">
          <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search student name, ID, or department" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" /></label>
          <div className="flex flex-wrap gap-1">{NODE_TYPES.map(type => <button key={type} onClick={() => toggle(setNodeFilters, type)} className={`rounded-full px-2.5 py-1 text-xs ${nodeFilters[type] ? 'bg-campus-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{type}</button>)}</div>
          <div className="flex flex-wrap gap-1">{RELATIONSHIPS.map(type => <button key={type} onClick={() => toggle(setRelationshipFilters, type)} className={`rounded-full px-2 py-1 text-[10px] ${relationshipFilters[type] ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{type}</button>)}</div>
          {user?.role === 'admin' && <div className="flex flex-wrap gap-2">
            <select value={riskFilter} onChange={event => setRiskFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><option>All</option><option>Low</option><option>Medium</option><option>High</option></select>
            <select value={communityFilter} onChange={event => setCommunityFilter(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"><option value="All">All communities</option>{communities.map(community => <option key={community.communityId} value={community.communityId}>{community.communityLabel || community.communityId}</option>)}</select>
          </div>}
        </CardContent></Card>
        <Card><CardHeader title="Shortest student connection path" subtitle="Path uses the backend graph analysis API." /><CardContent>
          <div className="flex flex-wrap gap-2">
            <select value={pathStart} onChange={event => setPathStart(event.target.value)} className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">From student…</option>{students.map(({ data }) => <option key={data.id} value={data.studentId || data.id}>{data.label} ({data.studentId || data.id})</option>)}</select>
            <select value={pathEnd} onChange={event => setPathEnd(event.target.value)} className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="">To student…</option>{students.map(({ data }) => <option key={data.id} value={data.studentId || data.id}>{data.label} ({data.studentId || data.id})</option>)}</select>
            <Button size="sm" onClick={findShortestPath} disabled={!pathStart || !pathEnd}>Show path</Button>
          </div>
          {pathMessage && <p className="mt-2 break-words text-xs text-slate-600">{pathMessage}</p>}
        </CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Campus relationships" subtitle="Drag nodes to rearrange; scroll or use controls to zoom." />
          <div className="flex items-center justify-between border-y border-slate-100 bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-500">{loading ? 'Loading graph…' : `${nodes.length} nodes · ${elements.length - nodes.length} relationships`}</span>
            <div className="flex gap-1">
              <button aria-label="Zoom in" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)} className="rounded p-1.5 hover:bg-slate-200"><ZoomIn className="h-4 w-4" /></button>
              <button aria-label="Zoom out" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)} className="rounded p-1.5 hover:bg-slate-200"><ZoomOut className="h-4 w-4" /></button>
              <button aria-label="Fit graph" onClick={() => cyRef.current?.fit(undefined, 30)} className="rounded p-1.5 hover:bg-slate-200"><RotateCcw className="h-4 w-4" /></button>
            </div>
          </div>
          <div ref={containerRef} className="h-[620px] bg-slate-50" />
        </Card>
        <Card>
          <CardHeader title="Selection details" subtitle="Select a node or relationship; connected nodes are highlighted." />
          <CardContent>
            {selected ? <div className="space-y-3">
              <div><p className="text-xs uppercase text-slate-400">{selected.kind} · {selected.data.type || selected.data.label}</p><p className="font-semibold text-slate-800">{selected.data.label || selected.data.id}</p></div>
              {selected.data.riskLevel && selected.data.riskLevel !== 'Low' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />{selected.data.riskLevel} risk · {selected.data.riskIndicators?.map(indicator => indicator.description || indicator.label).filter(Boolean).join('; ') || 'Review indicators recorded'}</div>}
              <div className="max-h-[380px] space-y-1 overflow-y-auto">{Object.entries(selected.data).filter(([key]) => key !== 'riskIndicators').map(([key, value]) => <div key={key} className="flex justify-between gap-2 border-b border-slate-100 py-1 text-xs"><span className="text-slate-500">{key}</span><span className="max-w-[65%] break-all text-right text-slate-800">{value == null ? '—' : String(value)}</span></div>)}</div>
            </div> : <div className="py-12 text-center text-sm text-slate-500"><AlertTriangle className="mx-auto mb-2 h-5 w-5 text-slate-300" />Select a graph element to inspect its details.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
