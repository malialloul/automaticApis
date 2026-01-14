import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  Chip,
  IconButton,
  TextField,
  Collapse,
  Button,
  Tooltip,
  Stack,
  Divider,
  Drawer,
  Badge,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  OutlinedInput,
  Checkbox,
  ListItemText as MuiListItemText,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InfoIcon from "@mui/icons-material/Info";
import LinkIcon from "@mui/icons-material/Link";
import { getSchema } from "../../services/api";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContext } from "../../App";

const HTTP_METHODS = [
  { value: "ALL", label: "All" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "DELETE", label: "DELETE" },
];

const API_TYPES = [
  { value: "ALL", label: "All" },
  { value: "CRUD", label: "CRUD" },
];

const getMethodColor = (method) => {
  const colors = {
    GET: "success",
    POST: "info",
    PUT: "warning",
    DELETE: "error",
  };
  return colors[method] || "default";
};

function EndpointExplorer({ connectionId, onTryIt, onGetCode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { schema } = useContext(AppContext);

  const bgPanel = theme.palette.background.paper;
  const bgSidebar = theme.palette.background.default;
  const textColor = theme.palette.text.primary;

  const [remoteEndpoints, setRemoteEndpoints] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState(null);
  // default to all concrete methods selected
  const allHttpMethods = HTTP_METHODS.filter((m) => m.value !== "ALL").map(
    (m) => m.value
  );
  // default to all API types selected (excluding ALL pseudo-value)
  const allApiTypes = API_TYPES.filter((t) => t.value !== "ALL").map(
    (t) => t.value
  );
  const [methodFilter, setMethodFilter] = useState(allHttpMethods);
  const [typeFilter, setTypeFilter] = useState(allApiTypes);
  const [tableFilter, setTableFilter] = useState([]);
  const [sidebar, setSidebar] = useState({ open: false, endpoint: null });
  const [copied, setCopied] = useState(null);

  // highlight arrays used to visually emphasize hidden items when opening the dropdown via +N
  const [highlightMethods, setHighlightMethods] = useState([]);
  const [highlightTypes, setHighlightTypes] = useState([]);
  const [highlightTables, setHighlightTables] = useState([]);

  // refs to enable programmatic opening of the Select dropdowns from +N chip
  const methodSelectRef = useRef(null);
  const typeSelectRef = useRef(null);
  const tableSelectRef = useRef(null);

  // controlled open state for Selects to avoid relying on dispatchEvent
  const [methodOpen, setMethodOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  useEffect(() => {
    if (!connectionId) return;

    // Try fetching generated endpoints from backend; fall back to schema-derived generation
    const fetchEndpoints = async () => {
      try {
        const res = await fetch(`/api/${connectionId}/__generated_endpoints`);
        if (!res.ok) throw new Error('no backend endpoints');
        const data = await res.json();
        if (data && data.endpoints) {
          // store fetched endpoints on a ref-like state
          setRemoteEndpoints(data.endpoints || []);
          return;
        }
      } catch (e) {
        // fallback to local generation
      }
    };

    fetchEndpoints();
  }, [connectionId]);

  const baseUrl = window.location.origin;


  // Quick stats
  const stats = useMemo(() => {
    if (remoteEndpoints && remoteEndpoints.length) {
      const total = remoteEndpoints.length;
      const crud = remoteEndpoints.filter((e) => e.type === "CRUD").length;
      const tables = new Set(remoteEndpoints.map((e) => e.table)).size;
      return { total, crud, tables };
    }
    if (!schema) return { total: 0, crud: 0, rel: 0, tables: 0 };
    // If only schema is available, show table count but no generated endpoints
    return { total: 0, crud: 0, rel: 0, tables: Object.keys(schema).length };
  }, [remoteEndpoints, schema]);

  // Table list for filter
  const tableList = useMemo(
    () => (schema ? Object.keys(schema) : []),
    [schema]
  );

  // Ensure tables default to all when schema is loaded
  useEffect(() => {
    if (tableList.length > 0 && (!tableFilter || tableFilter.length === 0)) {
      setTableFilter(tableList);
    }
  }, [tableList]);

  // Filtering
  const filteredTables = useMemo(() => {
    if (!schema) return [];
    let entries = Object.entries(schema);
    if (search)
      entries = entries.filter(([t]) =>
        t.toLowerCase().includes(search.toLowerCase())
      );
    if (tableFilter.length > 0)
      entries = entries.filter(([t]) => tableFilter.includes(t));
    return entries;
  }, [schema, search, tableFilter]);

  // Endpoint filter (supports multi-select methodFilter and typeFilter)
  const filterEndpoints = (eps) => {
    return eps.filter((e) => {
      const totalMethods = allHttpMethods.length;
      const totalTypes = allApiTypes.length;
      const methodPass =
        // no method selected -> show all
        (Array.isArray(methodFilter) && methodFilter.length === 0) ||
        // 'ALL' explicitly selected OR all concrete methods selected -> show all
        (Array.isArray(methodFilter) &&
          (methodFilter.includes("ALL") ||
            methodFilter.length === totalMethods)) ||
        // selected methods include the endpoint method
        (Array.isArray(methodFilter) && methodFilter.includes(e.method));

      const typePass =
        (Array.isArray(typeFilter) && typeFilter.length === 0) ||
        (Array.isArray(typeFilter) &&
          (typeFilter.includes("ALL") || typeFilter.length === totalTypes)) ||
        (Array.isArray(typeFilter) && typeFilter.includes(e.type));

      return methodPass && typePass;
    });
  };

  // Copy helpers
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  // Sidebar open
  const openSidebar = (endpoint) => setSidebar({ open: true, endpoint });
  const closeSidebar = () => setSidebar({ open: false, endpoint: null });

  // Placeholder for code and try-it
  const handleTryIt = (endpoint) => alert("Try it panel coming soon!");
  const handleGetCode = (endpoint) => alert("Code modal coming soon!");

  // Navigate to a specific table in the list and focus it
  const goToTable = (tableName) => {
    setExpandedTable(tableName);
    closeSidebar();
    setTimeout(() => {
      const el = document.getElementById(`table-${tableName}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  };

  // Try a sample cross-table call by injecting sample path params (replaces `:param` tokens with `1`)
  const trySampleEndpoint = (endpoint) => {
    if (!endpoint || !endpoint.path) return;
    const samplePath = endpoint.path.replace(/:([a-zA-Z0-9_]+)/g, "1");
    const sampleParams = {};
    (endpoint.params || []).forEach((p) => {
      if (p.type === "path") sampleParams[p.name] = "1";
    });
    const sampleEndpoint = { ...endpoint, path: samplePath, sampleParams };
    if (onTryIt) onTryIt(sampleEndpoint);
    else handleTryIt(sampleEndpoint);
    closeSidebar();
  };

  if (!schema) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography>
          No schema loaded. Please introspect a database first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, position: "relative", bgcolor: bgPanel, color: textColor }}
    >
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Generated APIs
        </Typography>
        {expandedTable && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            All available endpoints for <b>{schema && expandedTable}</b>
          </Typography>
        )}
        {remoteEndpoints === null && (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            No generated endpoints were returned from the backend. The frontend no longer generates endpoints locally—ensure the backend's <code>/__generated_endpoints</code> endpoint is available.
          </Typography>
        )}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>HTTP Method</InputLabel>
            <Select
              multiple
              value={methodFilter}
              onChange={(e) => {
                const v = e.target.value;
                const selected = typeof v === "string" ? v.split(",") : v;
                // if 'ALL' selected => select all concrete methods
                if (selected.includes("ALL")) {
                  setMethodFilter(allHttpMethods);
                  return;
                }
                // normalize and ensure at least one selection
                const unique = Array.from(new Set(selected));
                if (unique.length === 0) {
                  // if user cleared selection, default to all methods
                  setMethodFilter(allHttpMethods);
                } else if (unique.length === allHttpMethods.length) {
                  setMethodFilter(allHttpMethods);
                } else {
                  setMethodFilter(unique);
                }
              }}
              input={
                <OutlinedInput label="HTTP Method" inputRef={methodSelectRef} />
              }
              open={methodOpen}
              onOpen={() => setMethodOpen(true)}
              onClose={() => { setMethodOpen(false); setHighlightMethods([]); }}
              renderValue={(selected) => {
                const maxVisible = 2;
                const visible = selected.slice(0, maxVisible);
                const remaining = selected.length - visible.length;
                const hiddenLabels = selected
                  .slice(maxVisible)
                  .map(
                    (v) => HTTP_METHODS.find((m) => m.value === v)?.label || v
                  )
                  .join(", ");
                const openMethodSelect = (ev) => {
                  ev.stopPropagation();
                  if (ev.preventDefault) ev.preventDefault();
                  // highlight the hidden items so they stand out in the menu
                  setHighlightMethods(selected.slice(maxVisible));
                  // open the controlled Select instead of dispatching events
                  setMethodOpen(true);
                  try { methodSelectRef?.current?.focus?.(); } catch (e) { }
                };
                return (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flexWrap: "nowrap",
                      overflow: "hidden",
                      alignItems: "center",
                    }}
                  >
                    {visible.map((val) => {
                      const label =
                        HTTP_METHODS.find((m) => m.value === val)?.label || val;
                      const handleDelete = (e) => {
                        e.stopPropagation();
                        if (e.preventDefault) e.preventDefault();
                        if (
                          e.nativeEvent &&
                          typeof e.nativeEvent.stopImmediatePropagation ===
                          "function"
                        ) {
                          e.nativeEvent.stopImmediatePropagation();
                        }
                        const next = methodFilter.filter((m) => m !== val);
                        if (next.length === 0) setMethodFilter(allHttpMethods);
                        else setMethodFilter(next);
                      };
                      // color chip per method
                      const methodColorKey = getMethodColor(val);
                      const chipBg = theme.palette[methodColorKey]?.main;
                      const chipSx = chipBg
                        ? {
                          bgcolor: chipBg,
                          color: theme.palette.getContrastText(chipBg),
                        }
                        : {};
                      return (
                        <Chip
                          key={val}
                          label={label}
                          size="small"
                          onDelete={handleDelete}
                          onMouseDown={(e) => e.stopPropagation()}
                          sx={chipSx}
                        />
                      );
                    })}
                    {remaining > 0 && (
                      <Tooltip title={hiddenLabels}>
                        <Chip
                          label={`+${remaining}`}
                          size="small"
                          sx={{ opacity: 0.85, cursor: "pointer" }}
                          onClick={openMethodSelect}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    )}
                  </Box>
                );
              }}
              label="HTTP Method"
            >
              {HTTP_METHODS.map((m) => (
                <MenuItem
                  key={m.value}
                  value={m.value}
                  sx={
                    highlightMethods.includes(m.value)
                      ? {
                        bgcolor: (t) =>
                          t.palette[getMethodColor(m.value)]?.light ||
                          t.palette.action.selected,
                        fontWeight: 700,
                      }
                      : {}
                  }
                >
                  <Checkbox
                    checked={
                      m.value === "ALL"
                        ? methodFilter.length === allHttpMethods.length
                        : methodFilter.indexOf(m.value) > -1
                    }
                  />
                  <MuiListItemText primary={m.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>API Type</InputLabel>
            <Select
              multiple
              value={typeFilter}
              onChange={(e) => {
                const v = e.target.value;
                const selected = typeof v === "string" ? v.split(",") : v;
                if (selected.includes("ALL")) {
                  setTypeFilter(allApiTypes);
                  return;
                }
                const unique = Array.from(new Set(selected));
                if (unique.length === 0) setTypeFilter(allApiTypes);
                else if (unique.length === allApiTypes.length)
                  setTypeFilter(allApiTypes);
                else setTypeFilter(unique);
              }}
              input={
                <OutlinedInput label="API Type" inputRef={typeSelectRef} />
              }
              open={typeOpen}
              onOpen={() => setTypeOpen(true)}
              onClose={() => { setTypeOpen(false); setHighlightTypes([]); }}
              renderValue={(selected) => {
                const maxVisible = 1;
                const visible = selected.slice(0, maxVisible);
                const remaining = selected.length - visible.length;
                const hiddenLabels = selected
                  .slice(maxVisible)
                  .map((v) => API_TYPES.find((m) => m.value === v)?.label || v)
                  .join(", ");
                const openTypeSelect = (ev) => {
                  ev.stopPropagation();
                  if (ev.preventDefault) ev.preventDefault();
                  setHighlightTypes(selected.slice(maxVisible));
                  setTypeOpen(true);
                  try { typeSelectRef?.current?.focus?.(); } catch (e) { }
                };
                return (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flexWrap: "nowrap",
                      overflow: "hidden",
                      alignItems: "center",
                    }}
                  >
                    {visible.map((val) => {
                      const label =
                        API_TYPES.find((m) => m.value === val)?.label || val;
                      const handleDelete = (ev) => {
                        ev.stopPropagation();
                        if (ev.preventDefault) ev.preventDefault();
                        if (
                          ev.nativeEvent &&
                          typeof ev.nativeEvent.stopImmediatePropagation ===
                          "function"
                        ) {
                          ev.nativeEvent.stopImmediatePropagation();
                        }
                        const next = typeFilter.filter((t) => t !== val);
                        if (next.length === 0) setTypeFilter(allApiTypes);
                        else setTypeFilter(next);
                      };
                      return (
                        <Chip
                          key={val}
                          label={label}
                          size="small"
                          onDelete={handleDelete}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        />
                      );
                    })}
                    {remaining > 0 && (
                      <Tooltip title={hiddenLabels}>
                        <Chip
                          label={`+${remaining}`}
                          size="small"
                          sx={{ opacity: 0.85, cursor: "pointer" }}
                          onClick={(ev) => {
                            setHighlightTypes(selected.slice(maxVisible));
                            openTypeSelect(ev);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    )}
                  </Box>
                );
              }}
              label="API Type"
            >
              {API_TYPES.map((t) => (
                <MenuItem
                  key={t.value}
                  value={t.value}
                  sx={
                    highlightTypes.includes(t.value)
                      ? {
                        bgcolor: (t2) => t2.palette.primary.light,
                        fontWeight: 700,
                      }
                      : {}
                  }
                >
                  <Checkbox
                    checked={
                      t.value === "ALL"
                        ? typeFilter.length === allApiTypes.length
                        : typeFilter.indexOf(t.value) > -1
                    }
                  />
                  <MuiListItemText primary={t.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Table</InputLabel>
            <Select
              multiple
              value={tableFilter}
              onChange={(e) => {
                const v = e.target.value;
                const selected = typeof v === "string" ? v.split(",") : v;
                const unique = Array.from(new Set(selected));
                if (unique.length === 0) setTableFilter(tableList);
                else setTableFilter(unique);
              }}
              input={<OutlinedInput label="Table" inputRef={tableSelectRef} />}
              open={tableOpen}
              onOpen={() => setTableOpen(true)}
              onClose={() => { setTableOpen(false); setHighlightTables([]); }}
              renderValue={(selected) => {
                const maxVisible = 2;
                const visible = selected.slice(0, maxVisible);
                const remaining = selected.length - visible.length;
                const hiddenLabels = selected.slice(maxVisible).join(", ");
                const openTableSelect = (ev) => {
                  ev.stopPropagation();
                  if (ev.preventDefault) ev.preventDefault();
                  setHighlightTables(selected.slice(maxVisible));
                  setTableOpen(true);
                  try {
                    try { tableSelectRef?.current?.focus?.(); } catch (e) { }
                    // also notify the graph to focus those nodes
                    const ids = selected.slice(maxVisible);
                    if (ids && ids.length > 0) {
                      if (
                        location &&
                        location.pathname &&
                        location.pathname.startsWith("/er-diagram")
                      ) {
                        // already on diagram page, dispatch event
                        window.dispatchEvent(
                          new CustomEvent("graph:focusNodes", {
                            detail: { ids },
                          })
                        );
                      } else {
                        // navigate to diagram and store pending focus (RelationshipGraph will pick it up)
                        window.__pendingGraphFocus = ids;
                        try {
                          navigate("/er-diagram");
                          // if navigate didn't change location (rare), fallback to window.location
                          setTimeout(() => {
                            if (
                              !location ||
                              !location.pathname ||
                              !location.pathname.startsWith("/er-diagram")
                            ) {
                              window.location.href = "/er-diagram";
                            }
                          }, 250);
                        } catch (navErr) {
                          // fallback
                          window.location.href = "/er-diagram";
                        }
                      }
                    }
                  } catch (e) {
                    console.error(e);
                  }
                };
                return (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flexWrap: "nowrap",
                      overflow: "hidden",
                      alignItems: "center",
                    }}
                  >
                    {visible.map((val) => {
                      const handleDelete = (ev) => {
                        ev.stopPropagation();
                        if (ev.preventDefault) ev.preventDefault();
                        if (
                          ev.nativeEvent &&
                          typeof ev.nativeEvent.stopImmediatePropagation ===
                          "function"
                        ) {
                          ev.nativeEvent.stopImmediatePropagation();
                        }
                        const next = tableFilter.filter((t) => t !== val);
                        if (next.length === 0) setTableFilter(tableList);
                        else setTableFilter(next);
                      };
                      return (
                        <Chip
                          key={val}
                          label={val}
                          size="small"
                          onDelete={handleDelete}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        />
                      );
                    })}
                    {remaining > 0 && (
                      <Tooltip title={hiddenLabels}>
                        <Chip
                          label={`+${remaining}`}
                          size="small"
                          sx={{ opacity: 0.85, cursor: "pointer" }}
                          onClick={(ev) => {
                            setHighlightTables(selected.slice(maxVisible));
                            openTableSelect(ev);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      </Tooltip>
                    )}
                  </Box>
                );
              }}
            >
              {tableList.map((t) => (
                <MenuItem
                  key={t}
                  value={t}
                  sx={
                    highlightTables.includes(t)
                      ? {
                        bgcolor: (th) => th.palette.info.light,
                        fontWeight: 700,
                      }
                      : {}
                  }
                >
                  <Checkbox checked={tableFilter.indexOf(t) > -1} />
                  <MuiListItemText primary={t} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Quick Stats */}
          <Box sx={{ ml: "auto", display: "flex", gap: 2 }}>
            <Chip label={`Total: ${stats.total}`} color="default" />
            <Chip label={`CRUD: ${stats.crud}`} color="primary" />
            <Chip label={`Relationships: ${stats.rel}`} color="secondary" />
            <Chip label={`Tables: ${stats.tables}`} color="info" />
          </Box>
        </Stack>
        <Divider />
      </Box>

      {/* Endpoints List */}
      {filteredTables.map(([tableName, tableInfo]) => {
        // Prefer backend-provided endpoints if available (frontend-side generation removed)
        let endpoints = [];
        if (remoteEndpoints) {
          endpoints = remoteEndpoints.filter((e) => e.table === tableName || (e.path && e.path.includes(`/${tableName}/`)));
        }
        if (endpoints.length === 0) return null;
        const isExpanded = expandedTable === tableName;
        return (
          <Box key={tableName} id={`table-${tableName}`} sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 2,
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? t.palette.background.paper
                    : "grey.100",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? t.palette.grey[800]
                      : "grey.200",
                },
                borderRadius: 1,
                cursor: "pointer",
              }}
              onClick={() => setExpandedTable(isExpanded ? null : tableName)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h6" sx={{ color: "text.primary" }}>
                  {tableName}
                </Typography>
                <Badge
                  badgeContent={endpoints.length}
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>
              <IconButton size="small">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={isExpanded}>
              <List>
                {endpoints.map((endpoint, idx) => (
                  <ListItem
                    key={idx}
                    alignItems="flex-start"
                    sx={{
                      flexDirection: "column",
                      alignItems: "flex-start",
                      borderBottom: 1,
                      borderColor: "divider",
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                      }}
                    >
                      <Chip
                        label={endpoint.method}
                        size="small"
                        color={getMethodColor(endpoint.method)}
                      />
                      {endpoint.type === "REL" && (
                        <Tooltip title="Relationship">
                          <LinkIcon fontSize="small" color="secondary" />
                        </Tooltip>
                      )}
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace", flex: 1 }}
                      >
                        {endpoint.path}
                      </Typography>
                      <Tooltip title="Copy endpoint">
                        <IconButton
                          size="small"
                          onClick={() =>
                            copyToClipboard(`${baseUrl}${endpoint.path}`)
                          }
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      {endpoint.description}
                    </Typography>
                    {endpoint.relationship && (
                      <Typography
                        variant="caption"
                        color="info.main"
                        sx={{ mb: 1 }}
                      >
                        Relationship: {typeof endpoint.relationship === 'object' ? JSON.stringify(endpoint.relationship) : endpoint.relationship}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <Button
                        size="small"
                        startIcon={<PlayArrowIcon />}
                        onClick={() =>
                          onTryIt ? onTryIt(endpoint) : handleTryIt(endpoint)
                        }
                      >
                        Try it
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CodeIcon />}
                        onClick={() =>
                          onGetCode
                            ? onGetCode(endpoint)
                            : handleGetCode(endpoint)
                        }
                      >
                        Get Code
                      </Button>
                      {endpoint._meta?.canonical && (
                        <Tooltip title="Canonical pair path">
                          <Chip label="Canonical" size="small" />
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        startIcon={<InfoIcon />}
                        onClick={() => openSidebar(endpoint)}
                      >
                        Details
                      </Button>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        );
      })}

      {/* Endpoint Details Sidebar */}
      <Drawer
        anchor="right"
        open={sidebar.open}
        onClose={closeSidebar}
        PaperProps={{
          sx: { width: 420, bgcolor: bgSidebar, color: textColor },
        }}
      >
        <Box sx={{ p: 3 }}>
          {sidebar.endpoint ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {sidebar.endpoint.method}{" "}
                <span style={{ color: "#888" }}>{sidebar.endpoint.path}</span>
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {sidebar.endpoint.description}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2">Parameters</Typography>
              <List dense>
                {sidebar.endpoint.params?.map((p, i) => (
                  <ListItem key={i} sx={{ pl: 0 }}>
                    <MuiListItemText
                      primary={<b>{p.name}</b>}
                      secondary={`${p.type} - ${p.desc}`}
                    />
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Response</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  bgcolor: bgPanel,
                  color: textColor,
                  fontFamily: "monospace",
                  fontSize: 13,
                  mb: 2,
                }}
              >
                {sidebar.endpoint.response}
              </Paper>
              <Typography variant="subtitle2">Example Request</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  bgcolor: bgPanel,
                  color: textColor,
                  fontFamily: "monospace",
                  fontSize: 13,
                  mb: 2,
                  overflowX: "auto",
                  maxWidth: "100%",
                }}
              >
                <Box
                  component="pre"
                  sx={{ m: 0, whiteSpace: "pre", overflowX: "auto" }}
                >
                  curl -X {sidebar.endpoint.method} {baseUrl}
                  {sidebar.endpoint.path}
                </Box>
              </Paper>

              {/* Cross-table metadata (friendly UI) */}
              {sidebar.endpoint._meta?.crossTable && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    Cross-table metadata
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1, bgcolor: bgPanel, color: textColor, mb: 2 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                      <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => trySampleEndpoint(sidebar.endpoint)}>
                        Try sample
                      </Button>
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <b>Join table:</b> {sidebar.endpoint._meta.crossTable.tableName}
                    </Typography>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="subtitle2">fkA</Typography>
                        <Typography variant="body2">
                          <b>Column:</b>{' '}
                          {sidebar.endpoint._meta.crossTable.fkA?.columnName ?? 'N/A'}
                        </Typography>
                        <Typography variant="body2">
                          <b>References:</b>{' '}
                          {sidebar.endpoint._meta.crossTable.fkA?.foreignTable ? (
                            <Button size="small" onClick={() => goToTable(sidebar.endpoint._meta.crossTable.fkA.foreignTable)}>
                              {sidebar.endpoint._meta.crossTable.fkA.foreignTable}
                            </Button>
                          ) : (
                            'N/A'
                          )}
                          {sidebar.endpoint._meta.crossTable.fkA?.foreignColumn ? `.${sidebar.endpoint._meta.crossTable.fkA.foreignColumn}` : ''}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2">fkB</Typography>
                        <Typography variant="body2">
                          <b>Column:</b>{' '}
                          {sidebar.endpoint._meta.crossTable.fkB?.columnName ?? 'N/A'}
                        </Typography>
                        <Typography variant="body2">
                          <b>References:</b>{' '}
                          {sidebar.endpoint._meta.crossTable.fkB?.foreignTable ? (
                            <Button size="small" onClick={() => goToTable(sidebar.endpoint._meta.crossTable.fkB.foreignTable)}>
                              {sidebar.endpoint._meta.crossTable.fkB.foreignTable}
                            </Button>
                          ) : (
                            'N/A'
                          )}
                          {sidebar.endpoint._meta.crossTable.fkB?.foreignColumn ? `.${sidebar.endpoint._meta.crossTable.fkB.foreignColumn}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </>
              )}

              <Typography variant="subtitle2">Status Codes</Typography>
              <List dense>
                <ListItem sx={{ pl: 0 }}>
                  <MuiListItemText primary="200 OK" />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <MuiListItemText primary="404 Not Found" />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <MuiListItemText primary="201 Created" />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <MuiListItemText primary="204 No Content" />
                </ListItem>
              </List>
            </>
          ) : (
            <Typography>No endpoint selected.</Typography>
          )}
        </Box>
      </Drawer>
    </Paper>
  );
}

export default EndpointExplorer;
