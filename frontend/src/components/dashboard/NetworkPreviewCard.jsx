import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Network, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import api from '../../services/api';

export const NetworkPreviewCard = () => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fallback initial data in case database is just spinning up
  const fallbackElements = [
    // Students
    { data: { id: 's1', label: 'Aarav Sharma', type: 'Student', department: 'Computer Science' } },
    { data: { id: 's2', label: 'Priya Patel', type: 'Student', department: 'Data Science' } },
    { data: { id: 's3', label: 'Rohan Gupta', type: 'Student', department: 'Cybersecurity' } },
    { data: { id: 's4', label: 'Ananya D.', type: 'Student', department: 'Computer Science' } },
    // Entities
    { data: { id: 'c1', label: 'CS302 Graph Theory', type: 'Course' } },
    { data: { id: 'cl1', label: 'ACM Chapter', type: 'Club' } },
    { data: { id: 'e1', label: 'Hackathon 2026', type: 'Event' } },
    { data: { id: 'i1', label: 'Machine Learning', type: 'Interest' } },
    // Edges
    { data: { source: 's1', target: 's2', label: 'FRIENDS_WITH' } },
    { data: { source: 's1', target: 's3', label: 'FRIENDS_WITH' } },
    { data: { source: 's1', target: 'c1', label: 'STUDIES' } },
    { data: { source: 's2', target: 'c1', label: 'STUDIES' } },
    { data: { source: 's1', target: 'cl1', label: 'MEMBER_OF' } },
    { data: { source: 's2', target: 'e1', label: 'PARTICIPATES_IN' } },
    { data: { source: 's1', target: 'i1', label: 'HAS_INTEREST' } },
    { data: { source: 's4', target: 's1', label: 'FOLLOWS' } },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadGraph = async () => {
      let elements = fallbackElements;
      try {
        const res = await api.get('/students/network/overview?limit=40');
        if (res.data?.data?.elements?.nodes?.length > 0) {
          const apiNodes = res.data.data.elements.nodes;
          const apiEdges = res.data.data.elements.edges;
          elements = [...apiNodes, ...apiEdges];
        }
      } catch (err) {
        console.info('[NetworkPreview] Using local graph blueprint preview');
      }

      if (!isMounted || !containerRef.current) return;

      if (cyRef.current) {
        cyRef.current.destroy();
      }

      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#3b82f6',
              'label': 'data(label)',
              'color': '#1e293b',
              'font-size': '11px',
              'font-weight': 600,
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'width': 36,
              'height': 36,
              'border-width': 2,
              'border-color': '#ffffff',
              'shadow-blur': 6,
              'shadow-color': 'rgba(0,0,0,0.15)',
            }
          },
          // Node type color coding
          {
            selector: 'node[type = "Student"]',
            style: { 'background-color': '#2563eb' }
          },
          {
            selector: 'node[type = "Course"]',
            style: { 'background-color': '#10b981', 'shape': 'round-rectangle' }
          },
          {
            selector: 'node[type = "Club"]',
            style: { 'background-color': '#8b5cf6', 'shape': 'diamond' }
          },
          {
            selector: 'node[type = "Event"]',
            style: { 'background-color': '#f59e0b', 'shape': 'triangle' }
          },
          {
            selector: 'node[type = "Interest"]',
            style: { 'background-color': '#ec4899', 'shape': 'hexagon' }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#cbd5e1',
              'target-arrow-color': '#94a3b8',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '8px',
              'color': '#64748b',
              'text-rotation': 'autorotate',
              'text-background-opacity': 0.8,
              'text-background-color': '#ffffff',
              'text-background-padding': 2,
            }
          },
          {
            selector: ':selected',
            style: {
              'border-width': 4,
              'border-color': '#0ea5e9',
              'shadow-blur': 12,
              'shadow-color': '#0ea5e9'
            }
          }
        ],
        layout: {
          name: 'cose',
          animate: false,
          nodeOverlap: 20,
          idealEdgeLength: 80,
          edgeElasticity: 100,
          nestingFactor: 5,
        }
      });

      cyRef.current.on('tap', 'node', (evt) => {
        const node = evt.target;
        setSelectedNode(node.data());
      });

      cyRef.current.on('tap', (evt) => {
        if (evt.target === cyRef.current) {
          setSelectedNode(null);
        }
      });

      setLoading(false);
    };

    loadGraph();

    return () => {
      isMounted = false;
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, []);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleReset = () => cyRef.current?.fit();

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Interactive Social & Academic Graph"
        subtitle="Neo4j Cypher Relationship Visualization (Cytoscape.js)"
        action={
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Legend */}
      <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600"></span> Student
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-emerald-500"></span> Course
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rotate-45 bg-purple-500"></span> Club
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 clip-triangle bg-amber-500"></span> Event
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-pink-500 rounded-full"></span> Interest
        </span>
      </div>

      <CardContent className="p-0 relative">
        <div ref={containerRef} className="w-full h-80 bg-slate-50" />

        {/* Selected Node Details Box */}
        {selectedNode && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-md rounded-xl p-3 text-xs max-w-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-slate-900">{selectedNode.label}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-campus-100 text-campus-700">
                {selectedNode.type}
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              ID: <span className="font-mono text-slate-700">{selectedNode.id}</span>
            </p>
            {selectedNode.department && (
              <p className="text-slate-500 text-[11px]">Department: {selectedNode.department}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

