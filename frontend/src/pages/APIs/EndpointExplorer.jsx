import React, { useState, useEffect, useMemo, useContext, forwardRef, useImperativeHandle } from "react";
import { Dialog, DialogContent, DialogActions } from '@mui/material';
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
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  OutlinedInput,
  Checkbox,
  ListItemText as MuiListItemText,
  CircularProgress,
  alpha,
  useTheme,
  Alert,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InfoIcon from "@mui/icons-material/Info";
import LinkIcon from "@mui/icons-material/Link";
import RefreshIcon from "@mui/icons-material/Refresh";
import TableChartIcon from "@mui/icons-material/TableChart";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CloseIcon from "@mui/icons-material/Close";
import { listEndpoints, previewGraph } from "../../services/api";
import { AppContext } from "../../App";
import { useGetRemoteEndpoints } from "../../_shared/database/useGetRemoteEndpoints";

const getMethodColor = (method) => {
  const colors = {
    GET: "success",
    POST: "info",
    PUT: "warning",
    DELETE: "error",
  };
  return colors[method] || "default";
};

const EndpointExplorer = forwardRef(function EndpointExplorer({ connectionId, onTryIt, onGetCode }, ref) {
  const theme = useTheme();
  const { data: remoteEndpoints, loading: remoteEndpointsLoading } = useGetRemoteEndpoints({ connectionId });
  
  const { schema } = useContext(AppContext);

  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState(null);
  const [sidebar, setSidebar] = useState({ open: false, endpoint: null });
  const [copied, setCopied] = useState(null);

  const [savedEndpoints, setSavedEndpoints] = useState([]);
  const [savedPreview, setSavedPreview] = useState(null);
  const [savedPreviewOpen, setSavedPreviewOpen] = useState(false);
  const [savedPreviewError, setSavedPreviewError] = useState(null);
  const [showRawSql, setShowRawSql] = useState(true);
  const baseUrl = window.location.origin;

  // Expose refresh method to parent via ref
  const refreshEndpoints = () => {
    listEndpoints()
      .then((res) => setSavedEndpoints(res || []))
      .catch(() => setSavedEndpoints([]));
  };

  useImperativeHandle(ref, () => ({
    refresh: refreshEndpoints
  }));

  // Filtering
  const filteredTables = useMemo(() => {
    if (!schema) return [];
    let entries = Object.entries(schema);
    if (search)
      entries = entries.filter(([t]) =>
        t.toLowerCase().includes(search.toLowerCase())
      );
    return entries;
  }, [connectionId, search, schema]);

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

  // Load saved endpoints
  useEffect(() => {
    let mounted = true;
    listEndpoints()
      .then((res) => {
        if (!mounted) return;
        setSavedEndpoints(res || []);
      })
      .catch(() => {
        if (!mounted) return;
        setSavedEndpoints([]);
      });
    return () => { mounted = false; };
  }, [remoteEndpoints]);

  const handleShowSavedSql = async (endpoint) => {
    if (!connectionId) {
      setSavedPreviewError('No active connection selected — select a connection to preview SQL.');
      setSavedPreviewOpen(true);
      return;
    }
    setSavedPreview(null);
    setSavedPreviewError(null);
    try {
      const graphToUse = endpoint.graph || endpoint;
      const res = await previewGraph(connectionId, graphToUse, 5);
      setSavedPreview(res);
      setSavedPreviewOpen(true);
    } catch (err) {
      setSavedPreviewError(err.response?.data?.error || err.message || 'Preview failed');
      setSavedPreviewOpen(true);
    }
  };

  const handleCloseSavedPreview = () => { 
    setSavedPreviewOpen(false); 
    setSavedPreview(null); 
    setSavedPreviewError(null); 
  };

  // Navigate to a specific table in the list and focus it
  const goToTable = (tableName) => {
    setExpandedTable(tableName);
    closeSidebar();
    setTimeout(() => {
      const el = document.getElementById(`table-${tableName}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  };

  if (!schema) {
    return (
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 6, 
          textAlign: "center", 
          borderRadius: 3,
          borderStyle: "dashed",
        }}
      >
        <TableChartIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          No Schema Loaded
        </Typography>
        <Typography color="text.secondary">
          Please introspect a database first to see available endpoints.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Search and Saved APIs Section */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
          <TextField
            size="small"
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ 
              minWidth: 250,
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }}
          />
          <Box sx={{ flex: 1 }} />
          {remoteEndpointsLoading && <CircularProgress size={20} />}
          <Button 
            size="small" 
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => listEndpoints().then(res => setSavedEndpoints(res || []))}
            sx={{ borderRadius: 2, textTransform: "none" }}
          >
            Refresh
          </Button>
        </Stack>

        {/* Saved APIs */}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <BookmarkIcon sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="subtitle2" fontWeight={600}>Saved APIs</Typography>
            <Chip 
              label={savedEndpoints.filter(ep => ep.connectionId === connectionId).length} 
              size="small" 
              sx={{ 
                height: 20, 
                fontSize: 11,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: "primary.main",
              }} 
            />
          </Box>
          {savedEndpoints.filter(ep => ep.connectionId === connectionId).length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              No saved APIs for this connection. Use the API Builder to create custom endpoints.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {savedEndpoints.filter(ep => ep.connectionId === connectionId).map((ep) => (
                <Box 
                  key={ep.slug} 
                  sx={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Chip 
                    label={ep.method || "GET"} 
                    size="small" 
                    color={getMethodColor(ep.method || "GET")}
                    sx={{ height: 24, fontWeight: 600 }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{ep.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {ep.path || `/${ep.slug}`}
                    </Typography>
                  </Box>
                  <Tooltip title="Show SQL">
                    <IconButton 
                      size="small" 
                      onClick={() => handleShowSavedSql(ep)}
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                      }}
                    >
                      <CodeIcon fontSize="small" sx={{ color: "primary.main" }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy path">
                    <IconButton 
                      size="small" 
                      onClick={() => copyToClipboard(ep.path || `/${ep.slug}`)}
                      sx={{ 
                        bgcolor: "action.hover",
                        "&:hover": { bgcolor: "action.selected" },
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    sx={{ borderRadius: 2, textTransform: "none" }}
                    onClick={() => {
                      const table = ep.graph?.source?.table || ep.source?.table;
                      if (!table) {
                        setSavedPreviewError('No source table found on this saved endpoint.');
                        setSavedPreviewOpen(true);
                        return;
                      }
                      if (onTryIt) onTryIt({ table, method: ep.method || 'GET', path: ep.path || `/${ep.slug}`, endpoint: ep });
                      else handleTryIt(ep);
                    }}
                  >
                    Try it
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Generated Endpoints List */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        {filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""} with endpoints
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {filteredTables.map(([tableName, tableInfo]) => {
          let endpoints = [];
          if (remoteEndpoints) {
            endpoints = remoteEndpoints.filter((e) => e.table === tableName);
          }
          if (endpoints.length === 0) return null;
          const isExpanded = expandedTable === tableName;
          return (
            <Paper
              key={tableName}
              id={`table-${tableName}`}
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: "hidden",
                border: 1,
                borderColor: isExpanded ? "primary.main" : "divider",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 2,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={() => setExpandedTable(isExpanded ? null : tableName)}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <TableChartIcon sx={{ color: "primary.main", fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {tableName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                </Box>
                <IconButton size="small">
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={isExpanded}>
                <Box sx={{ borderTop: 1, borderColor: "divider" }}>
                  {endpoints.map((endpoint, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 2,
                        borderBottom: idx < endpoints.length - 1 ? 1 : 0,
                        borderColor: "divider",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Chip
                          label={endpoint.method}
                          size="small"
                          color={getMethodColor(endpoint.method)}
                          sx={{ fontWeight: 600, height: 24 }}
                        />
                        {endpoint.type === "REL" && (
                          <Tooltip title="Relationship Endpoint">
                            <Chip
                              icon={<LinkIcon sx={{ fontSize: "14px !important" }} />}
                              label="Relation"
                              size="small"
                              variant="outlined"
                              color="secondary"
                              sx={{ height: 24 }}
                            />
                          </Tooltip>
                        )}
                        <Typography
                          variant="body2"
                          sx={{ 
                            fontFamily: "monospace", 
                            flex: 1,
                            color: "text.primary",
                          }}
                        >
                          {endpoint.path}
                        </Typography>
                        <Tooltip title="Copy full URL">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${baseUrl}${endpoint.path}`);
                            }}
                            sx={{ 
                              bgcolor: "action.hover",
                              "&:hover": { bgcolor: "action.selected" },
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                        {endpoint.description}
                      </Typography>
                      {endpoint.relationship && (
                        <Chip
                          label={typeof endpoint.relationship === 'object' ? JSON.stringify(endpoint.relationship) : endpoint.relationship}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ mb: 1.5, height: 22, fontSize: 11 }}
                        />
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => onTryIt ? onTryIt(endpoint) : handleTryIt(endpoint)}
                          sx={{ borderRadius: 2, textTransform: "none" }}
                        >
                          Try it
                        </Button>
                        {endpoint._meta?.canonical && (
                          <Chip label="Canonical" size="small" variant="outlined" sx={{ height: 28 }} />
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>

      {/* SQL Preview Dialog */}
      <Dialog 
        open={savedPreviewOpen} 
        onClose={handleCloseSavedPreview} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 2.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CodeIcon sx={{ color: "white", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>SQL Preview</Typography>
              <Typography variant="caption" color="text.secondary">
                Generated query for saved API
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseSavedPreview}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 2.5 }}>
          {savedPreviewError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{savedPreviewError}</Alert>
          )}
          {savedPreview && (
            <Box>
              {savedPreview.summary && (
                <Typography sx={{ mb: 2 }} color="text.secondary">{savedPreview.summary}</Typography>
              )}
              <Collapse in={showRawSql}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>SQL Query</Typography>
                <Paper
                  variant="outlined"
                  sx={{ 
                    p: 2, 
                    bgcolor: "grey.900", 
                    borderRadius: 2,
                    mb: 2,
                  }}
                >
                  <Box 
                    component="pre" 
                    sx={{ 
                      m: 0, 
                      color: "#10B981", 
                      fontFamily: "monospace",
                      fontSize: 13,
                      overflow: "auto",
                    }}
                  >
                    {savedPreview.sql}
                  </Box>
                </Paper>
                {savedPreview.params && savedPreview.params.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Parameters</Typography>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Box component="pre" sx={{ m: 0, fontSize: 12, overflow: "auto" }}>
                        {JSON.stringify(savedPreview.params, null, 2)}
                      </Box>
                    </Paper>
                  </Box>
                )}
              </Collapse>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Sample Results</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, maxHeight: 300, overflow: "auto" }}>
                <Box component="pre" sx={{ m: 0, fontSize: 12 }}>
                  {JSON.stringify(savedPreview.rows || [], null, 2)}
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: "divider" }}>
          <Button onClick={() => setShowRawSql((s) => !s)} sx={{ borderRadius: 2, textTransform: "none" }}>
            {showRawSql ? 'Hide SQL' : 'Show SQL'}
          </Button>
          <Button variant="contained" onClick={handleCloseSavedPreview} sx={{ borderRadius: 2, textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Endpoint Details Sidebar */}
      <Drawer
        anchor="right"
        open={sidebar.open}
        onClose={closeSidebar}
        PaperProps={{
          sx: { 
            width: 420, 
            bgcolor: "background.default",
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          {sidebar.endpoint ? (
            <>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <InfoIcon sx={{ color: "white", fontSize: 22 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700}>
                    Endpoint Details
                  </Typography>
                </Box>
                <IconButton onClick={closeSidebar}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                  <Chip 
                    label={sidebar.endpoint.method} 
                    size="small" 
                    color={getMethodColor(sidebar.endpoint.method)}
                    sx={{ fontWeight: 600 }}
                  />
                  <Typography 
                    variant="body2" 
                    sx={{ fontFamily: "monospace", color: "text.secondary" }}
                  >
                    {sidebar.endpoint.path}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {sidebar.endpoint.description}
                </Typography>
              </Paper>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Parameters</Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                <List dense disablePadding>
                  {sidebar.endpoint.params?.map((p, i) => (
                    <ListItem 
                      key={i} 
                      sx={{ 
                        borderBottom: i < sidebar.endpoint.params.length - 1 ? 1 : 0, 
                        borderColor: "divider",
                      }}
                    >
                      <MuiListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{p.name}</Typography>}
                        secondary={`${p.type} - ${p.desc}`}
                      />
                    </ListItem>
                  ))}
                  {(!sidebar.endpoint.params || sidebar.endpoint.params.length === 0) && (
                    <ListItem>
                      <Typography variant="body2" color="text.secondary">No parameters</Typography>
                    </ListItem>
                  )}
                </List>
              </Paper>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Response</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: "grey.900",
                  borderRadius: 2,
                  fontFamily: "monospace",
                  fontSize: 13,
                  mb: 2,
                }}
              >
                <Box sx={{ color: "#10B981" }}>
                  {sidebar.endpoint.response || "JSON response"}
                </Box>
              </Paper>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Example Request</Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: "grey.900",
                  borderRadius: 2,
                  mb: 2,
                  overflowX: "auto",
                }}
              >
                <Box
                  component="pre"
                  sx={{ m: 0, color: "#F59E0B", fontFamily: "monospace", fontSize: 13 }}
                >
                  curl -X {sidebar.endpoint.method} {baseUrl}{sidebar.endpoint.path}
                </Box>
              </Paper>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Status Codes</Typography>
              <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                <List dense disablePadding>
                  {[
                    { code: "200 OK", color: "success.main" },
                    { code: "201 Created", color: "info.main" },
                    { code: "204 No Content", color: "warning.main" },
                    { code: "404 Not Found", color: "error.main" },
                  ].map((status, i) => (
                    <ListItem 
                      key={i}
                      sx={{ 
                        borderBottom: i < 3 ? 1 : 0, 
                        borderColor: "divider",
                      }}
                    >
                      <Typography variant="body2" sx={{ color: status.color }}>
                        {status.code}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <InfoIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
              <Typography color="text.secondary">No endpoint selected.</Typography>
            </Box>
          )}
        </Box>
      </Drawer>
    </Box>
  );
});

export default EndpointExplorer;
