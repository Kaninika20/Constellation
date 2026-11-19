import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Network, ZoomIn, ZoomOut, RotateCcw, Filter, ShieldAlert, Sparkles, Database } from 'lucide-react';
import api from '../services/api';

export const NetworkPage = () => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [activeFilters, setActiveFilters] = useState({
    Student: true,
    Course: true,
    Club: true,
    Event: true,
    Interest: true
  });
  const [rawElements, setRawElements] = useState([]);
  const [stats, setStats] = useState({ nodeCount: 0, edgeCount: 0 });

  const defaultMockElements = [
    { data: { id: 'STU2026001', label: 'Aarav Sharma', type: 'Student', department: 'Computer Science', year: 3 } },
    { data: { id: 'STU2026002', label: 'Priya Patel', type: 'Student', department: 'Data Science', year: 4 } },
    { data: { id: 'STU2026003', label: 'Rohan Gupta', type: 'Student', department: 'Cybersecurity', year: 3 } },
    { data: { id: 'STU2026004', label: 'Ananya Deshmukh', type: 'Student', department: 'Computer Science', year: 2 } },
    { data: { id: 'STU2026005', label: 'Vikram Verma', type: 'Student', department: 'Information Tech', year: 4 } },
    { data: { id: 'STU2026999', label: 'Bot_Account_Alert', type: 'Student', department: 'Unknown', riskScore: 0.88 } },
    // Entities
    { data: { id: 'CS302', label: 'CS302 Database & Graph', type: 'Course' } },
    { data: { id: 'DS201', label: 'DS201 Social Network Analytics', type: 'Course' } },
    { data: { id: 'CLUB_ACM', label: 'ACM Chapter', type: 'Club' } },
    { data: { id: 'CLUB_CYB', label: 'Cybersecurity Alliance', type: 'Club' } },
    { data: { id: 'EVT_HACK26', label: 'Campus Hackathon 2026', type: 'Event' } },
    { data: { id: 'INT_GRAPH', label: 'Graph Databases', type: 'Interest' } },
    { data: { id: 'INT_FRAUD', label: 'Fraud Detection', type: 'Interest' } },
    // Relationships
    { data: { id: 'e1', source: 'STU2026001', target: 'STU2026002', label: 'FRIENDS_WITH' } },
    { data: { id: 'e2', source: 'STU2026001', target: 'STU2026003', label: 'FRIENDS_WITH' } },
    { data: { id: 'e3', source: 'STU2026001', target: 'CS302', label: 'STUDIES' } },
    { data: { id: 'e4', source: 'STU2026002', target: 'CS302', label: 'STUDIES' } },
    { data: { id: 'e5', source: 'STU2026001', target: 'CLUB_ACM', label: 'MEMBER_OF' } },
    { data: { id: 'e6', source: 'STU2026002', target: 'EVT_HACK26', label: 'PARTICIPATES_IN' } },
    { data: { id: 'e7', source: 'STU2026001', target: 'INT_GRAPH', label: 'HAS_INTEREST' } },
    { data: { id: 'e8', source: 'STU2026003', target: 'INT_FRAUD', label: 'HAS_INTEREST' } },
    { data: { id: 'e9', source: 'STU2026999', target: 'STU2026001', label: 'FOLLOWS' } },
    { data: { id: 'e10', source: 'STU2026999', target: 'STU2026002', label: 'FOLLOWS' } },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/students/network/overview?limit=100');
        if (res.data?.data?.elements?.nodes?.length > 0) {
          const fetchedNodes = res.data.data.elements.nodes;
          const fetchedEdges = res.data.data.elements.edges;
          setRawElements([...fetchedNodes, ...fetchedEdges]);
          setStats({ nodeCount: fetchedNodes.length, edgeCount: fetchedEdges.length });
          return;
        }
      } catch (err) {
        console.info('[NetworkPage] Using fallback graph elements');
      }
      setRawElements(defaultMockElements);
      setStats({ nodeCount: 13, edgeCount: 10 });
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!containerRef.current || rawElements.length === 0) return;

    // Filter elements according to active filters
    const filteredNodes = rawElements.filter(el => {
      if (el.data.source && el.data.target) return false; // edge
      const type = el.data.type || 'Student';
      return activeFilters[type] !== false;
    });

    const activeNodeIds = new Set(filteredNodes.map(n => n.data.id));

    const filteredEdges = rawElements.filter(el => {
      if (!el.data.source || !el.data.target) return false;
      return activeNodeIds.has(el.data.source) && activeNodeIds.has(el.data.target);
    });

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [...filteredNodes, ...filteredEdges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#3b82f6',
            'label': 'data(label)',
            'color': '#0f172a',
            'font-size': '11px',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'width': 42,
            'height': 42,
            'border-width': 2.5,
            'border-color': '#ffffff',
            'shadow-blur': 8,
            'shadow-color': 'rgba(0,0,0,0.12)',
          }
        },
        {
          selector: 'node[type = "Student"]',
          style: { 'background-color': '#2563eb' }
        },
        {
          selector: 'node[riskScore > 0.5]',
          style: { 'background-color': '#ef4444', 'border-color': '#fecaca' }
        },
        {
          selector: 'node[type = "Course"]',
          style: { 'background-color': '#10b981', 'shape': 'round-rectangle', 'width': 46, 'height': 38 }
        },
        {
          selector: 'node[type = "Club"]',
          style: { 'background-color': '#8b5cf6', 'shape': 'diamond', 'width': 44, 'height': 44 }
        },
        {
          selector: 'node[type = "Event"]',
          style: { 'background-color': '#f59e0b', 'shape': 'triangle', 'width': 44, 'height': 44 }
        },
        {
          selector: 'node[type = "Interest"]',
          style: { 'background-color': '#ec4899', 'shape': 'hexagon', 'width': 40, 'height': 40 }
        },
        {
          selector: 'edge',
          style: {
            'width': 2.5,
            'line-color': '#cbd5e1',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#64748b',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.85,
            'text-background-color': '#ffffff',
            'text-background-padding': 2,
          }
        },
        {
          selector: 'edge[label = "FRIENDS_WITH"]',
          style: { 'line-color': '#93c5fd', 'target-arrow-color': '#3b82f6' }
        },
        {
          selector: 'edge[label = "STUDIES"]',
          style: { 'line-color': '#a7f3d0', 'target-arrow-color': '#10b981' }
        },
        {
          selector: 'edge[label = "FOLLOWS"]',
          style: { 'line-style': 'dashed', 'line-color': '#fca5a5', 'target-arrow-color': '#ef4444' }
        },
        {
          selector: ':selected',
          style: {
            'border-width': 4,
            'border-color': '#0284c7',
            'shadow-blur': 14,
            'shadow-color': '#0284c7'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 6500,
        idealEdgeLength: 100,
        edgeElasticity: 100,
      }
    });

    cyRef.current.on('tap', 'node', (evt) => {
      setSelectedEntity({ kind: 'node', data: evt.target.data() });
    });

    cyRef.current.on('tap', 'edge', (evt) => {
      setSelectedEntity({ kind: 'edge', data: evt.target.data() });
    });

    cyRef.current.on('tap', (evt) => {
      if (evt.target === cyRef.current) {
        setSelectedEntity(null);
      }
    });
  }, [rawElements, activeFilters]);

  const toggleFilter = (type) => {
    setActiveFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Network className="w-6 h-6 text-campus-600" />
            Campus Graph Network Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time visual traversal of nodes and Cypher relationships powered by Cytoscape.js
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
          {Object.keys(activeFilters).map(type => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                activeFilters[type]
                  ? 'bg-campus-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas & Details Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Graph Canvas */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col h-[650px] relative">
          {/* Controls Bar */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-campus-600" />
                Rendered Nodes: <span className="font-bold text-slate-900">{stats.nodeCount}</span>
              </span>
              <span>•</span>
              <span>Relationships: <span className="font-bold text-slate-900">{stats.edgeCount}</span></span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => cyRef.current?.fit()}
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg"
                title="Fit View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cytoscape Container */}
          <div ref={containerRef} className="flex-1 w-full bg-slate-50/50" />
        </div>

        {/* Right Inspector Drawer */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Graph Element Inspector"
              subtitle="Tap any node or edge to inspect attributes"
            />
            <CardContent>
              {selectedEntity ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-campus-50 border border-campus-100">
                    <span className="text-[10px] font-bold text-campus-700 uppercase tracking-wider block">
                      {selectedEntity.kind.toUpperCase()}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                      {selectedEntity.data.label || selectedEntity.data.id}
                    </h4>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-slate-600">
                    {Object.entries(selectedEntity.data).map(([key, val]) => (
                      <div key={key} className="flex justify-between py-1 border-b border-slate-100 font-mono text-[11px]">
                        <span className="text-slate-500 font-sans">{key}:</span>
                        <span className="font-semibold text-slate-800 text-right truncate max-w-[150px]">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedEntity.data.riskScore && selectedEntity.data.riskScore > 0.5 && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 mt-3">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">High Risk Anomaly Flag</span>
                        <span className="text-[11px]">Flagged by Sybil detection algorithm (Week 3 readiness).</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <Network className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Select any node or relationship to inspect its properties.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relationship Legend */}
          <Card>
            <CardHeader title="Relationship Schema" subtitle="Defined Cypher edge types" />
            <CardContent className="space-y-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-800 text-[11px]">
                [:FRIENDS_WITH] (Student ↔ Student)
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 text-[11px]">
                [:STUDIES] (Student → Course)
              </div>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-800 text-[11px]">
                [:MEMBER_OF] (Student → Club)
              </div>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-800 text-[11px]">
                [:PARTICIPATES_IN] (Student → Event)
              </div>
              <div className="p-2 rounded-lg bg-pink-50 text-pink-800 text-[11px]">
                [:HAS_INTEREST] (Student → Interest)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

