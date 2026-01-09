import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Paper, Typography, Box, Alert, Stack, FormControlLabel, Switch, IconButton, Tooltip, Button } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap, applyNodeChanges } from 'reactflow';
import UMLClassNode from './graph/UMLClassNode';
import AssociationEdge from './graph/AssociationEdge';
import { toPng, toSvg } from 'html-to-image';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { getSchema } from '../services/api';

const UMLDiagram = ({ connectionId }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [schema, setSchema] = useState(null);
  const [showAttributes, setShowAttributes] = useState(true);
  const [autoLayout, setAutoLayout] = useState(true);
  const containerRef = useRef(null);
  const layoutKey = useMemo(() => (connectionId ? `layout:${connectionId}:uml` : null), [connectionId]);

  // Stable types to prevent re-creation and avoid hook order issues
  const memoNodeTypes = useMemo(() => ({ umlClassNode: UMLClassNode }), []);
  const memoEdgeTypes = useMemo(() => ({ association: AssociationEdge }), []);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;

      try {
        const s = await getSchema(connectionId);
        setSchema(s);
        const tableNames = Object.keys(s);
        const inferStereotype = (name) => {
          const n = (name || '').toLowerCase();
          if (n.includes('enum') || n.includes('lookup') || n.endsWith('_type') || n.includes('type_')) return '<<enumeration>>';
          return '<<entity>>';
        };

        // Create nodes for each table
        const existingPos = new Map(nodes.map(n => [n.id, n.position]));
        const newNodes = tableNames.map((tableName, index) => {
          const x = (index % 4) * 300;
          const y = Math.floor(index / 4) * 150;
          const cols = s[tableName].columns || [];
          const pkSet = new Set((s[tableName].primaryKeys || []));
          const stereotype = inferStereotype(tableName);
          return {
            id: tableName,
            type: 'umlClassNode',
            data: {
              tableName,
              columns: cols,
              primaryKeys: Array.from(pkSet),
              showAttributes,
              stereotype,
            },
            position: (!autoLayout && existingPos.has(tableName)) ? existingPos.get(tableName) : { x, y },
            style: {},
          };
        });

        // Create edges for relationships (use both FKs and reverse FKs; avoid duplicates)
        const newEdges = [];
        const added = new Set();
        let edgeId = 0;

        // Map of stereotypes for quick checks
        const stereotypes = Object.fromEntries(tableNames.map(t => [t, inferStereotype(t)]));

        Object.entries(s).forEach(([tableName, tableInfo]) => {
          // direct foreign keys
          (tableInfo.foreignKeys || []).forEach(fk => {
            const srcId = tableName;
            const tgtId = fk.foreignTable || fk.referencedTable || fk?.references?.table || fk.foreign_table;
            if (!tgtId) return;
            const key = `${srcId}->${tgtId}`;
            if (added.has(key)) return;
            added.add(key);
            const colLabel = fk.columnName || fk.referencingColumn || fk.foreignColumn || fk.referencedColumn || 'FK';
            const isUse = (stereotypes[srcId] === '<<enumeration>>' || stereotypes[tgtId] === '<<enumeration>>');
            newEdges.push({
              id: `e${edgeId++}`,
              source: srcId,
              target: tgtId,
              type: 'association',
              data: { label: isUse ? `${colLabel} <<use>>` : `${colLabel}` , sourceMultiplicity: 'N', targetMultiplicity: '1' },
              style: isUse ? { stroke: '#EF4444', strokeWidth: 4, strokeDasharray: '6 4' } : { stroke: '#EF4444', strokeWidth: 4 },
            });
          });
          // reverse foreign keys (tables referencing current)
          (tableInfo.reverseForeignKeys || []).forEach(rfk => {
            const srcId = rfk.referencingTable || rfk.table || rfk.sourceTable;
            const tgtId = tableName;
            if (!srcId) return;
            const key = `${srcId}->${tgtId}`;
            if (added.has(key)) return;
            added.add(key);
            const colLabel = rfk.referencingColumn || rfk.column || 'FK';
            const isUse = (stereotypes[srcId] === '<<enumeration>>' || stereotypes[tgtId] === '<<enumeration>>');
            newEdges.push({
              id: `e${edgeId++}`,
              source: srcId,
              target: tgtId,
              type: 'association',
              data: { label: isUse ? `${colLabel} <<use>>` : `${colLabel}`, sourceMultiplicity: 'N', targetMultiplicity: '1' },
              style: isUse ? { stroke: '#EF4444', strokeWidth: 4, strokeDasharray: '6 4' } : { stroke: '#EF4444', strokeWidth: 4 },
            });
          });
        });

        const saved = layoutKey ? JSON.parse(localStorage.getItem(layoutKey) || '{}') : {};
        const positionedNodes = autoLayout
          ? applyDagreLayout(newNodes, newEdges, showAttributes)
          : newNodes.map(n => (saved[n.id] ? { ...n, position: saved[n.id] } : n));
        setNodes(positionedNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };

    loadSchema();
  }, [connectionId, showAttributes, autoLayout]);

  const applyDagreLayout = (nodes, edges, attributesExpanded) => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 });
    g.setDefaultEdgeLabel(() => ({}));
    nodes.forEach(n => {
      const baseH = attributesExpanded ? 220 : 90;
      g.setNode(n.id, { width: 200, height: baseH });
    });
    edges.forEach(e => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - 100, y: pos.y - 45 } };
    });
  };

  const mermaidUML = useMemo(() => {
    if (!schema) return '';
    const lines = ['classDiagram'];
    for (const [t, info] of Object.entries(schema)) {
      lines.push(`class ${t} {`);
      for (const col of info.columns || []) {
        const pkMark = (info.primaryKeys || []).includes(col.name) ? '<PK> ' : '';
        lines.push(`  ${pkMark}${col.name}${col.type ? `: ${col.type}` : ''}`);
      }
      lines.push('}');
    }
    for (const [t, info] of Object.entries(schema)) {
      for (const fk of info.foreignKeys || []) {
        // Association t --> foreignTable
        lines.push(`${t} --> ${fk.foreignTable} : ${fk.columnName} (N:1)`);
      }
    }
    return lines.join('\n');
  }, [schema]);

  const handleExportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = 'uml-diagram.png';
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
      link.download = 'uml-diagram.svg';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('SVG export failed', e);
    }
  };

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      // save positions
      if (layoutKey) {
        const positions = Object.fromEntries(updated.map(n => [n.id, n.position]));
        try { localStorage.setItem(layoutKey, JSON.stringify(positions)); } catch {}
      }
      return updated;
    });
  }, [layoutKey]);

  const resetLayout = useCallback(() => {
    if (layoutKey) {
      try { localStorage.removeItem(layoutKey); } catch {}
    }
    setAutoLayout(true);
  }, [layoutKey]);

  if (!connectionId) {
    return (
      <Alert severity="info">
        Please select a connection to view UML diagram
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, height: '600px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" gutterBottom>
          UML Class Diagram
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControlLabel
            control={<Switch checked={showAttributes} onChange={(e) => setShowAttributes(e.target.checked)} />}
            label="Show attributes"
          />
          <FormControlLabel
            control={<Switch checked={autoLayout} onChange={(e) => setAutoLayout(e.target.checked)} />}
            label="Auto layout"
          />
          <Button variant="outlined" size="small" onClick={resetLayout}>Reset Layout</Button>
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
          nodeTypes={memoNodeTypes}
          edgeTypes={memoEdgeTypes}
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
      {/* Mermaid UML available for copy/use in docs if needed */}
      {/* Hidden by default; can wire a copy button later using mermaidUML */}
    </Paper>
  );
};
export default UMLDiagram;
