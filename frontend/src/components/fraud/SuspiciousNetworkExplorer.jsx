import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { AlertTriangle, Network } from 'lucide-react';
import api from '../../services/api';

export const SuspiciousNetworkExplorer = ({ studentId, onSelectAccount }) => {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const selectAccountRef = useRef(onSelectAccount);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    selectAccountRef.current = onSelectAccount;
  }, [onSelectAccount]);

  useEffect(() => {
    let active = true;
    setNetwork(null);
    setError('');
    setLoading(true);
    api.get(`/admin/student/${encodeURIComponent(studentId)}/suspicious-network`)
      .then(response => {
        if (active) setNetwork(response.data?.data || null);
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.message || 'The suspicious network could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [studentId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !network) return undefined;
    graphRef.current?.destroy();
    graphRef.current = cytoscape({
      container,
      elements: [
        ...network.nodes.map(node => ({
          data: {
            id: node.studentId,
            studentId: node.studentId,
            label: node.name || node.studentId,
            suspicious: node.suspicious,
            riskLevel: node.riskLevel,
            distance: node.distance
          }
        })),
        ...network.edges.map(edge => ({
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.type
          }
        }))
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': node => node.data('suspicious') ? '#dc2626' : '#2563eb',
            label: 'data(label)',
            color: '#0f172a',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            width: 34,
            height: 34,
            'border-width': 2,
            'border-color': '#fff'
          }
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '7px',
            color: '#475569'
          }
        },
        {
          selector: 'edge[label = "FRIENDS_WITH"]',
          style: { 'target-arrow-shape': 'none', 'line-color': '#60a5fa' }
        },
        {
          selector: 'edge[label = "FOLLOWS"]',
          style: { 'line-style': 'dashed', 'line-color': '#f87171' }
        }
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: 5000, idealEdgeLength: 90 },
      minZoom: 0.2,
      maxZoom: 3
    });
    graphRef.current.on('tap', 'node', event => {
      selectAccountRef.current?.(event.target.data('studentId'));
    });
    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, [network]);

  return (
    <section className="space-y-2" aria-label="Suspicious account network">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Network className="h-4 w-4 text-campus-600" />Suspicious neighborhood
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Social connections up to two hops away. Red nodes have a stored medium/high risk score; select any node to inspect it.
        </p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {loading && <p className="text-xs text-slate-500">Loading account neighborhood…</p>}
      {network && (
        <>
          <p className="text-xs text-slate-500">
            {network.nodes.length} accounts · {network.edges.length} connections · {network.flaggedCount} flagged
            {network.truncated ? ' · display capped at 100 accounts' : ''}
          </p>
          <div ref={containerRef} className="h-72 rounded-xl border border-slate-200 bg-slate-50" />
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Other accounts</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600" />Medium/high stored risk</span>
          </div>
          {network.nodes.length === 1 && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <AlertTriangle className="h-3.5 w-3.5" />No friend or follow connections were found within two hops.
            </p>
          )}
        </>
      )}
    </section>
  );
};
