import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { Paper, Typography, Box, Alert, Stack, FormControlLabel, Switch, IconButton, Tooltip, Snackbar } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, applyNodeChanges } from 'reactflow';
import TableNode from './graph/TableNode';
import CrowsFootEdge from './graph/CrowsFootEdge';
import { toPng, toSvg } from 'html-to-image';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { getSchema } from '../services/api';

// Memoize nodeTypes and edgeTypes outside the component to avoid React Flow error 002
const nodeTypes = { tableNode: TableNode };
const edgeTypes = { crowsFoot: CrowsFootEdge };

const RelationshipGraph = ({ connectionId }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [schema, setSchema] = useState(null);
  const [showColumns, setShowColumns] = useState(true);
  const [copied, setCopied] = useState(false);
  const [autoLayout, setAutoLayout] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      try {
        const s = await getSchema(connectionId);
        setSchema(s);
        const tableNames = Object.keys(s);
        // Create nodes for each table
        const newNodes = tableNames.map((tableName, index) => {
          const x = (index % 4) * 300;
          const y = Math.floor(index / 4) * 150;
          const cols = s[tableName].columns || [];
          const pkSet = new Set((s[tableName].primaryKeys || []));
          return {
            id: tableName,
            type: 'tableNode',
            data: {
              tableName,
              columns: cols,
              primaryKeys: Array.from(pkSet),
              foreignKeys: s[tableName].foreignKeys || [],
              showColumns,
            },
            position: { x, y },
            style: {},
          };
        });
        // Create edges for foreign key relationships
        const newEdges = [];
        let edgeId = 0;
        Object.entries(s).forEach(([tableName, tableInfo]) => {
          tableInfo.foreignKeys?.forEach(fk => {
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
        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };
    loadSchema();
  }, [connectionId, showColumns]);

  // Memoize onNodesChange to avoid re-renders
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const applyDagreLayout = (nodes, edges, columnsExpanded) => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => {
      const baseH = columnsExpanded ? 220 : 90;
      g.setNode(n.id, { width: 180, height: baseH });
    });
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - 90, y: pos.y - 45 } };
    });
  };

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
    } catch {}
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

  if (!connectionId) {
    return (
      <Alert severity="info">
        Please select a connection to view relationship graph
      </Alert>
    );
  }

  if (nodes.length === 0) {
    return (
      <Alert severity="warning">
        No tables found. Please introspect the database first.
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, height: '600px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" gutterBottom>
          Table Relationships
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
        </Stack>
      </Box>
      <Box ref={containerRef} sx={{ height: 'calc(100% - 50px)', border: '1px solid #ddd', borderRadius: 1, bgcolor: '#fff' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable
          nodesConnectable={false}
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

export default memo(RelationshipGraph);
