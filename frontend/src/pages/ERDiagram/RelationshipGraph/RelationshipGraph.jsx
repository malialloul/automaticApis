import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { Paper, Typography, Box, Alert, Stack, FormControlLabel, Switch, IconButton, Tooltip, Snackbar } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, applyNodeChanges } from 'reactflow';
import TableNode from './graph/TableNode';
import CrowsFootEdge from './graph/CrowsFootEdge';
import { toPng, toSvg } from 'html-to-image';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { getSchema } from '../../../services/api';
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { useConnection } from '../../../_shared/database/useConnection';

// Memoize nodeTypes and edgeTypes outside the component to avoid React Flow error 002
const nodeTypes = { tableNode: TableNode };
const edgeTypes = { crowsFoot: CrowsFootEdge };

export const RelationshipGraph = () => {
  const {
    currentConnection,
  } = useConnection();
  const connectionId = currentConnection?.id;
  const databaseName = currentConnection?.database;
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [schema, setSchema] = useState(null);
  const [copied, setCopied] = useState(false);
  const [autoLayout, setAutoLayout] = useState(true);
  const containerRef = useRef(null);
  // React Flow instance ref to perform viewport operations (center/zoom)
  const rfRef = useRef(null);
  const [layoutDirection, setLayoutDirection] = useState('LR');
  // pending focus nodes that arrived before nodes were ready
  const [pendingFocusNodes, setPendingFocusNodes] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [fsAnimating, setFsAnimating] = useState(false);

  // Controls
  const handleFullscreen = async () => {
    try {
      if (!containerRef.current) return;

      // If native Fullscreen API is available, prefer it
      if (document.fullscreenEnabled && containerRef.current.requestFullscreen) {
        if (!document.fullscreenElement) {
          // Small visual cue before native fullscreen (optional)
          setFsAnimating(true);
          setTimeout(async () => {
            try {
              await containerRef.current.requestFullscreen();
              setFullscreen(true);
            } catch (err) {
              console.error('Native fullscreen request failed', err);
            } finally {
              setFsAnimating(false);
            }
          }, 120);
        } else {
          await document.exitFullscreen();
          setFullscreen(false);
        }
        return;
      }

      // Fallback: pseudo full-window mode with animation
      if (!pseudoFullscreen) {
        setFsAnimating(true);
        setPseudoFullscreen(true);
        // end animation after transition time
        setTimeout(() => setFsAnimating(false), 300);
      } else {
        setFsAnimating(true);
        setTimeout(() => {
          setPseudoFullscreen(false);
          setFsAnimating(false);
        }, 300);
      }
    } catch (err) {
      console.error('Fullscreen toggle failed', err);
      setFsAnimating(false);
    }
  };

  // Keep `fullscreen` state in sync with document fullscreen changes (ESC etc.)
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Close pseudo fullscreen on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && pseudoFullscreen) {
        setPseudoFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudoFullscreen]);
  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      try {
        const s = await getSchema(connectionId);
        setSchema(s);
        const tableNames = Object.keys(s || {});

        // Separate join tables (2+ FKs) from regular tables so we can place joins near their referenced tables
        const joinTables = tableNames.filter((t) => (s[t].foreignKeys || []).length >= 2);
        const regularTables = tableNames.filter((t) => !joinTables.includes(t));

        const posMap = {};
        const newNodes = [];

        // Layout regular tables in a simple grid first
        regularTables.forEach((tableName, idx) => {
          const x = (idx % 4) * 300;
          const y = Math.floor(idx / 4) * 150;
          posMap[tableName] = { x, y };
          const cols = s[tableName].columns || [];
          const pkSet = new Set((s[tableName].primaryKeys || []));
          newNodes.push({
            id: tableName,
            type: 'tableNode',
            data: {
              tableName,
              columns: cols,
              primaryKeys: Array.from(pkSet),
              foreignKeys: s[tableName].foreignKeys || [],
              showColumns: true,
            },
            position: { x, y },
            style: {},
          });
        });

        // Place join tables near the average position of their referenced tables (if possible)
        joinTables.forEach((tableName, jIdx) => {
          const fks = s[tableName].foreignKeys || [];
          const referenced = Array.from(new Set(fks.map((f) => f.foreignTable))).filter((r) => posMap[r]);
          let x, y;
          if (referenced.length > 0) {
            const avgX = referenced.reduce((acc, r) => acc + posMap[r].x, 0) / referenced.length;
            const avgY = referenced.reduce((acc, r) => acc + posMap[r].y, 0) / referenced.length;
            // offset join tables to avoid exact overlap
            const offset = ((jIdx % 3) - 1) * 80;
            x = avgX + 120 + offset;
            y = avgY + 40;
          } else {
            const idx = regularTables.length + jIdx;
            x = (idx % 4) * 300;
            y = Math.floor(idx / 4) * 150;
          }
          posMap[tableName] = { x, y };
          const cols = s[tableName].columns || [];
          const pkSet = new Set((s[tableName].primaryKeys || []));
          newNodes.push({
            id: tableName,
            type: 'tableNode',
            data: {
              tableName,
              columns: cols,
              primaryKeys: Array.from(pkSet),
              foreignKeys: s[tableName].foreignKeys || [],
              showColumns: true,
            },
            position: { x, y },
            style: {},
          });
        });

        // Create edges for foreign key relationships (unchanged)
        const newEdges = [];
        let edgeId = 0;
        Object.entries(s).forEach(([tableName, tableInfo]) => {
          tableInfo.foreignKeys?.forEach((fk) => {
            newEdges.push({
              id: `e${edgeId++}`,
              source: tableName,
              target: fk.foreignTable,
              type: 'crowsFoot',
              data: { label: `${fk.columnName} (N:1)` },
              sourceHandle: `${tableName}:${fk.columnName}`,
              targetHandle: `${fk.foreignTable}:${fk.foreignColumn}`,
              style: { stroke: '#1976d2' },
            });
          });
        });

        if (autoLayout) {
          const layouted = applyDagreLayout(newNodes, newEdges, layoutDirection);
          setNodes(layouted);
        } else {
          setNodes(newNodes);
        }
        setEdges(newEdges);

        // If the graph was requested to focus any nodes earlier, try to highlight/scroll them
        if (pendingFocusNodes && pendingFocusNodes.length > 0) {
          scrollToAndHighlight(pendingFocusNodes);
          setPendingFocusNodes([]);
        }
        // Also honor pending focus stored on the window (set by EndpointExplorer before navigation)
        if (window.__pendingGraphFocus && window.__pendingGraphFocus.length > 0) {
          scrollToAndHighlight(window.__pendingGraphFocus);
          window.__pendingGraphFocus = null;
        }
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };
    loadSchema();
  }, [connectionId]);

  // Memoize onNodesChange to avoid re-renders
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Helper: apply dagre layout to nodes/edges
  const applyDagreLayout = useCallback((ns, es, direction = 'LR') => {
    try {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: direction });
      const nodeWidth = 240;
      const nodeHeight = 100;
      ns.forEach((n) => {
        g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
      });
      es.forEach((e) => {
        // ignore self-edges
        if (e.source && e.target && e.source !== e.target) g.setEdge(e.source, e.target);
      });
      dagre.layout(g);
      return ns.map((n) => {
        const p = g.node(n.id);
        if (!p) return n;
        return {
          ...n,
          position: { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 },
        };
      });
    } catch (err) {
      console.error('Dagre layout failed', err);
      return ns;
    }
  }, []);

  // Scroll and highlight helper: center first available nodeId and add temporary highlight
  const scrollToAndHighlight = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    // find first existing node
    const id = ids.find((i) => nodes.some((n) => n.id === i));
    if (!id) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    try {
      if (rfRef.current && typeof rfRef.current.setCenter === 'function') {
        rfRef.current.setCenter(node.position.x, node.position.y, { duration: 500 });
      }
      // apply highlight styles
      setNodes((cur) =>
        cur.map((n) =>
          ids.includes(n.id)
            ? { ...n, style: { ...(n.style || {}), boxShadow: '0 0 0 8px rgba(25,118,210,0.12)' } }
            : n
        )
      );
      // remove highlights after a short delay
      setTimeout(() => {
        setNodes((cur) => cur.map((n) => ({ ...n, style: { ...(n.style || {}), boxShadow: undefined } })));
      }, 3000);
    } catch (err) {
      console.error('Scroll to node failed', err);
    }
  }, [nodes]);

  // Listen for external focus requests (e.g., +N chip clicked in EndpointExplorer)
  useEffect(() => {
    const onFocusRequest = (e) => {
      const ids = (e && e.detail && e.detail.ids) || [];
      if (!ids || ids.length === 0) return;
      if (nodes && nodes.length > 0) {
        scrollToAndHighlight(ids);
      } else {
        // nodes not ready yet; save for after load
        setPendingFocusNodes(ids);
      }
    };
    window.addEventListener('graph:focusNodes', onFocusRequest);
    return () => window.removeEventListener('graph:focusNodes', onFocusRequest);
  }, [nodes, scrollToAndHighlight]);
  // Re-layout when autoLayout toggles on
  useEffect(() => {
    if (!autoLayout) return;
    if (nodes.length === 0 || edges.length === 0) return;
    setNodes((cur) => applyDagreLayout(cur, edges, layoutDirection));
  }, [autoLayout, applyDagreLayout, edges, nodes.length, layoutDirection]);


  const mermaidER = useMemo(() => {
    if (!schema) return '';
    const lines = ['erDiagram'];
    for (const [t, info] of Object.entries(schema)) {
      lines.push(`${t} {`);
      for (const col of info.columns || []) {
        const pkMark = (info.primaryKeys || []).includes(col.name) ? ' PK' : '';
        lines.push(`  ${col.name} ${col.type || 'text'}${pkMark}`);
      }
      lines.push('}');
    }
    for (const [t, info] of Object.entries(schema)) {
      for (const fk of info.foreignKeys || []) {
        // t (child) N:1 related (parent)
        lines.push(`${t} }o--|| ${fk.foreignTable} : "${fk.columnName}"`);
      }
    }
    return lines.join('\n');
  }, [schema]);

  const handleCopyMermaid = async () => {
    try {
      await navigator.clipboard.writeText(mermaidER);
      setCopied(true);
    } catch { }
  };

  const handleExportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = 'er-diagram.png';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('PNG export failed', e);
    }
  };

  const handleExportSvg = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toSvg(containerRef.current);
      const link = document.createElement('a');
      link.download = 'er-diagram.svg';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('SVG export failed', e);
    }
  };


  return (
    <Paper elevation={3} sx={{ p: 3, height: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" gutterBottom>
          Table Relationships ({databaseName})
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center">

          <Tooltip title="Copy Mermaid ER diagram">
            <span>
              <IconButton onClick={handleCopyMermaid} disabled={!schema}>
                {/* simple copy icon using Unicode to avoid extra deps */}
                <span role="img" aria-label="copy">📋</span>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export PNG">
            <span>
              <IconButton onClick={handleExportPng} disabled={!schema}>
                <span role="img" aria-label="png">🖼️</span>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Export SVG">
            <span>
              <IconButton onClick={handleExportSvg} disabled={!schema}>
                <span role="img" aria-label="svg">🧩</span>
              </IconButton>
            </span>
          </Tooltip>

          <FormControlLabel
            control={<Switch checked={autoLayout} onChange={(e) => setAutoLayout(e.target.checked)} />}
            label="Auto Layout"
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Layout direction">
              <select
                value={layoutDirection}
                onChange={(e) => setLayoutDirection(e.target.value)}
                style={{ padding: '6px', borderRadius: 4 }}
              >
                <option value="LR">Left → Right</option>
                <option value="TB">Top → Bottom</option>
              </select>
            </Tooltip>
            <Tooltip title="Apply layout">
              <span>
                <IconButton onClick={() => setNodes((cur) => applyDagreLayout(cur, edges, layoutDirection))}>
                  🔁
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Tooltip title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            <IconButton onClick={handleFullscreen} color="inherit">
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

        </Stack>
      </Box>
      <Box
        ref={containerRef}
        sx={(t) => ({
          height: 'calc(100% - 50px)',
          border: '1px solid #ddd',
          borderRadius: 1,
          bgcolor: t.palette.background.paper,
          transition: 'transform 260ms ease, opacity 200ms ease',
          // pseudo-fullscreen styles
          ...(pseudoFullscreen
            ? {
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: t.zIndex.modal || 1300,
              borderRadius: 0,
              boxShadow: t.shadows?.[24] || '0 12px 24px rgba(0,0,0,0.2)',
              transform: fsAnimating ? 'scale(1.02)' : 'scale(1)',
              opacity: fsAnimating ? 0.98 : 1,
              overflow: 'hidden',
            }
            : {}),
        })}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable
          nodesConnectable={false}
          onInit={(instance) => (rfRef.current = instance)}
          onNodesChange={onNodesChange}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Box>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Mermaid ER copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Paper>
  );
};

