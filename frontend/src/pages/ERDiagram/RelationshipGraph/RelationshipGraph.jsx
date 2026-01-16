import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { Paper, Typography, Box, Alert, Stack, FormControlLabel, Switch, IconButton, Tooltip, Snackbar, alpha, useTheme, Chip, Select, MenuItem, Slider, ToggleButton, ToggleButtonGroup, Divider } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, applyNodeChanges } from 'reactflow';
import TableNode from './graph/TableNode';
import CrowsFootEdge from './graph/CrowsFootEdge';
import { toPng, toSvg } from 'html-to-image';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { getSchema } from '../../../services/api';
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ImageIcon from "@mui/icons-material/Image";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import RefreshIcon from "@mui/icons-material/Refresh";
import DrawIcon from "@mui/icons-material/Draw";
import CreateIcon from "@mui/icons-material/Create";
import DeleteIcon from "@mui/icons-material/Delete";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ClearIcon from "@mui/icons-material/Clear";
import MouseIcon from "@mui/icons-material/Mouse";
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

  // Whiteboard drawing state
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState('pen'); // 'pen' | 'eraser' | 'select'
  const [penColor, setPenColor] = useState('#ef4444');
  const [penSize, setPenSize] = useState(3);
  const [paths, setPaths] = useState([]); // Array of drawn paths
  const [currentPath, setCurrentPath] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const penColors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#000000', // black
    '#ffffff', // white
  ];

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

  // Drawing handlers
  const getCanvasCoords = useCallback((e) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e) => {
    if (!drawingMode || drawingTool === 'select') return;
    isDrawing.current = true;
    const coords = getCanvasCoords(e);
    setCurrentPath({
      points: [coords],
      color: drawingTool === 'eraser' ? 'eraser' : penColor,
      size: drawingTool === 'eraser' ? penSize * 4 : penSize,
    });
  }, [drawingMode, drawingTool, penColor, penSize, getCanvasCoords]);

  const draw = useCallback((e) => {
    if (!isDrawing.current || !currentPath) return;
    const coords = getCanvasCoords(e);
    setCurrentPath(prev => ({
      ...prev,
      points: [...prev.points, coords],
    }));
  }, [currentPath, getCanvasCoords]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current || !currentPath) {
      isDrawing.current = false;
      return;
    }
    isDrawing.current = false;
    if (currentPath.points.length > 1) {
      setUndoStack(prev => [...prev, paths]);
      setRedoStack([]);
      setPaths(prev => [...prev, currentPath]);
    }
    setCurrentPath(null);
  }, [currentPath, paths]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevPaths = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, paths]);
    setPaths(prevPaths);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, paths]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextPaths = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, paths]);
    setPaths(nextPaths);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, paths]);

  const handleClearCanvas = useCallback(() => {
    if (paths.length === 0) return;
    setUndoStack(prev => [...prev, paths]);
    setRedoStack([]);
    setPaths([]);
  }, [paths]);

  // Render paths to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all saved paths
    [...paths, currentPath].filter(Boolean).forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (path.color === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = path.size;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
      }
      
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  }, [paths, currentPath]);

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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
      {/* Header */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountTreeIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={700}>
                ER Diagram
              </Typography>
              {databaseName && (
                <Chip 
                  label={databaseName} 
                  size="small" 
                  sx={{ 
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    fontWeight: 500,
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Visualize table relationships and foreign keys
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Drawing Mode Toggle */}
          <Tooltip title={drawingMode ? 'Exit drawing mode' : 'Enter drawing mode'}>
            <IconButton 
              onClick={() => setDrawingMode(!drawingMode)}
              size="small"
              sx={{ 
                bgcolor: drawingMode 
                  ? (theme) => alpha(theme.palette.warning.main, 0.2)
                  : 'action.hover',
                color: drawingMode ? 'warning.main' : 'inherit',
                '&:hover': { 
                  bgcolor: drawingMode 
                    ? (theme) => alpha(theme.palette.warning.main, 0.3)
                    : 'action.selected' 
                },
              }}
            >
              <DrawIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Export buttons */}
          <Tooltip title="Copy Mermaid ER">
            <IconButton 
              onClick={handleCopyMermaid} 
              disabled={!schema}
              size="small"
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export PNG">
            <IconButton 
              onClick={handleExportPng} 
              disabled={!schema}
              size="small"
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Auto Layout Switch */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              bgcolor: 'action.hover',
              borderRadius: 2,
              px: 1.5,
              py: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Auto Layout
            </Typography>
            <Switch 
              checked={autoLayout} 
              onChange={(e) => setAutoLayout(e.target.checked)} 
              size="small"
            />
          </Box>

          {/* Layout Direction */}
          <Select
            value={layoutDirection}
            onChange={(e) => setLayoutDirection(e.target.value)}
            size="small"
            sx={{ 
              minWidth: 130,
              '& .MuiSelect-select': { py: 0.75 },
            }}
          >
            <MenuItem value="LR">Left → Right</MenuItem>
            <MenuItem value="TB">Top → Bottom</MenuItem>
          </Select>

          {/* Apply Layout */}
          <Tooltip title="Apply Layout">
            <IconButton 
              onClick={() => setNodes((cur) => applyDagreLayout(cur, edges, layoutDirection))}
              size="small"
              sx={{ 
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2) },
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Fullscreen */}
          <Tooltip title={fullscreen || pseudoFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton 
              onClick={handleFullscreen}
              size="small"
              sx={{ 
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              {fullscreen || pseudoFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Drawing Toolbar - Shows when in drawing mode (outside fullscreen) */}
      {drawingMode && !pseudoFullscreen && !fullscreen && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.05),
            borderColor: (theme) => alpha(theme.palette.warning.main, 0.3),
          }}
        >
          {/* Tool Selection */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Tool:
            </Typography>
            <ToggleButtonGroup
              value={drawingTool}
              exclusive
              onChange={(e, v) => v && setDrawingTool(v)}
              size="small"
            >
              <ToggleButton value="select" sx={{ px: 1.5 }}>
                <Tooltip title="Select / Pan">
                  <MouseIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="pen" sx={{ px: 1.5 }}>
                <Tooltip title="Pen">
                  <CreateIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="eraser" sx={{ px: 1.5 }}>
                <Tooltip title="Eraser">
                  <DeleteIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Color Selection */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Color:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {penColors.map((color) => (
                <Tooltip key={color} title={color}>
                  <Box
                    onClick={() => setPenColor(color)}
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: 1,
                      bgcolor: color,
                      border: 2,
                      borderColor: penColor === color ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Pen Size */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Size:
            </Typography>
            <Slider
              value={penSize}
              onChange={(e, v) => setPenSize(v)}
              min={1}
              max={20}
              size="small"
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 20, textAlign: 'center' }}>
              {penSize}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem />

          {/* Undo/Redo/Clear */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Undo">
              <span>
                <IconButton 
                  onClick={handleUndo} 
                  disabled={undoStack.length === 0}
                  size="small"
                >
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Redo">
              <span>
                <IconButton 
                  onClick={handleRedo} 
                  disabled={redoStack.length === 0}
                  size="small"
                >
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Clear All Drawings">
              <span>
                <IconButton 
                  onClick={handleClearCanvas} 
                  disabled={paths.length === 0}
                  size="small"
                  color="error"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Chip 
            label="Drawing Mode Active" 
            size="small" 
            color="warning"
            sx={{ fontWeight: 600 }}
          />
        </Paper>
      )}

      {/* Graph Container */}
      <Paper
        ref={containerRef}
        variant="outlined"
        sx={(t) => ({
          flex: 1,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: t.palette.background.paper,
          position: 'relative',
          transition: 'transform 260ms ease, opacity 200ms ease',
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
          nodesDraggable={!drawingMode || drawingTool === 'select'}
          panOnDrag={!drawingMode || drawingTool === 'select'}
          zoomOnScroll={!drawingMode || drawingTool === 'select'}
          nodesConnectable={false}
          onInit={(instance) => (rfRef.current = instance)}
          onNodesChange={onNodesChange}
        >
          <Background />
          <Controls />
          <MiniMap 
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: 8,
            }}
          />
        </ReactFlow>

        {/* Fullscreen Drawing Toolbar - Floating inside the container */}
        {drawingMode && (pseudoFullscreen || fullscreen) && (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              p: 1.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(8px)',
              border: (theme) => `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              maxWidth: 'calc(100% - 32px)',
            }}
          >
            {/* Tool Selection */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ToggleButtonGroup
                value={drawingTool}
                exclusive
                onChange={(e, v) => v && setDrawingTool(v)}
                size="small"
              >
                <ToggleButton value="select" sx={{ px: 1.5 }}>
                  <Tooltip title="Select / Pan">
                    <MouseIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="pen" sx={{ px: 1.5 }}>
                  <Tooltip title="Pen">
                    <CreateIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="eraser" sx={{ px: 1.5 }}>
                  <Tooltip title="Eraser">
                    <DeleteIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Color Selection */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {['#ff5722', '#4caf50', '#2196f3', '#9c27b0', '#f44336', '#ffffff', '#000000'].map(color => (
                <IconButton
                  key={color}
                  size="small"
                  onClick={() => setPenColor(color)}
                  sx={{
                    width: 24,
                    height: 24,
                    bgcolor: color,
                    border: penColor === color ? '2px solid' : '1px solid',
                    borderColor: penColor === color ? 'warning.main' : 'divider',
                    '&:hover': { bgcolor: color, opacity: 0.8 },
                  }}
                />
              ))}
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Pen Size */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
              <CreateIcon fontSize="small" color="action" />
              <Slider
                value={penSize}
                onChange={(e, v) => setPenSize(v)}
                min={1}
                max={20}
                size="small"
                sx={{ flex: 1 }}
              />
              <Typography variant="caption" sx={{ minWidth: 20, textAlign: 'center' }}>
                {penSize}
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Undo/Redo/Clear */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Undo">
                <span>
                  <IconButton 
                    onClick={handleUndo} 
                    disabled={undoStack.length === 0}
                    size="small"
                  >
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton 
                    onClick={handleRedo} 
                    disabled={redoStack.length === 0}
                    size="small"
                  >
                    <RedoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Clear All">
                <span>
                  <IconButton 
                    onClick={handleClearCanvas} 
                    disabled={paths.length === 0}
                    size="small"
                    color="error"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Exit Fullscreen */}
            <Tooltip title="Exit Fullscreen">
              <IconButton 
                onClick={() => {
                  if (fullscreen && document.exitFullscreen) {
                    document.exitFullscreen();
                  } else {
                    setPseudoFullscreen(false);
                  }
                }}
                size="small"
                color="warning"
              >
                <FullscreenExitIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>
        )}

        {/* Drawing Canvas Overlay */}
        {drawingMode && (
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: drawingTool === 'pen' 
                ? 'crosshair' 
                : drawingTool === 'eraser' 
                  ? 'cell' 
                  : 'default',
              pointerEvents: drawingTool === 'select' ? 'none' : 'auto',
              zIndex: 10,
            }}
          />
        )}
      </Paper>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Mermaid ER copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  );
};
