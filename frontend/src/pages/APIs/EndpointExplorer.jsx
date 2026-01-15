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
  CircularProgress,
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

function EndpointExplorer({ connectionId, onTryIt, onGetCode }) {
    const { data: remoteEndpoints, loading: remoteEndpointsLoading } = useGetRemoteEndpoints({ connectionId });
  
  const theme = useTheme();
  const { schema } = useContext(AppContext);
  const bgPanel = theme.palette.background.paper;
  const bgSidebar = theme.palette.background.default;
  const textColor = theme.palette.text.primary;

  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState(null);
  const [sidebar, setSidebar] = useState({ open: false, endpoint: null });
  const [copied, setCopied] = useState(null);

  const baseUrl = window.location.origin;

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
        {remoteEndpointsLoading && (
          <CircularProgress/>
        )}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 180 }}
          />
         
        </Stack>
        <Divider />
      </Box>

      {/* Endpoints List */}
      {filteredTables.map(([tableName, tableInfo]) => {
        // Prefer backend-provided endpoints if available (frontend-side generation removed)
        let endpoints = [];
        if (remoteEndpoints) {
          endpoints = remoteEndpoints .filter((e) => e.table === tableName   );
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
