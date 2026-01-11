import React, { useState, useEffect, useMemo } from "react";
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
import { getSchema } from "../services/api";
import { useTheme } from "@mui/material/styles";

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
  { value: "REL", label: "Relationships" },
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
  const bgPanel = theme.palette.background.paper;
  const bgSidebar = theme.palette.background.default;
  const textColor = theme.palette.text.primary;

  const [schema, setSchema] = useState(null);
  const [search, setSearch] = useState("");
  const [expandedTable, setExpandedTable] = useState(null);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [tableFilter, setTableFilter] = useState([]);
  const [sidebar, setSidebar] = useState({ open: false, endpoint: null });
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!connectionId) return;
    getSchema(connectionId)
      .then(setSchema)
      .catch(() => setSchema(null));
  }, [connectionId]);

  const baseUrl = window.location.origin;

  // Generate endpoints for a table
  const generateEndpoints = (tableName, tableInfo) => {
        const fks = tableInfo.foreignKeys || [];
  const endpoints = [
      {
        table: tableName,
        method: "GET",
        path: `/api/${connectionId}/${tableName}`,
        description: `List all ${tableName} with pagination`,
        params: [
          { name: "limit", type: "query", desc: "Max results" },
          { name: "offset", type: "query", desc: "Offset for pagination" },
          { name: "orderBy", type: "query", desc: "Order by column" },
          { name: "filter", type: "query", desc: "Filter conditions" },
        ],
        response: "200 OK",
        type: "CRUD",
      },
      {
        table: tableName,
        method: "GET",
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Get single ${tableName} by ID`,
        params: [{ name: "id", type: "path", desc: "Primary key" }],
        response: "200 OK / 404 Not Found",
        type: "CRUD",
      },
      {
        table: tableName,
        method: "POST",
        path: `/api/${connectionId}/${tableName}`,
        description: `Create new ${tableName}`,
        params: [{ name: "body", type: "body", desc: "Request body" }],
        response: "201 Created",
        type: "CRUD",
      },
      {
        table: tableName,
        method: "PUT",
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Update ${tableName}`,
        params: [
          { name: "id", type: "path", desc: "Primary key" },
          { name: "body", type: "body", desc: "Request body" },
        ],
        response: "200 OK",
        type: "CRUD",
      },
      {
        table: tableName,
        method: "DELETE",
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Delete ${tableName}`,
        params: [{ name: "id", type: "path", desc: "Primary key" }],
        response: "204 No Content",
        type: "CRUD",
      },
    ];
        // For join tables with 2+ FKs, add endpoints under each referenced table to get related records by the other FK
        if (fks.length >= 2 && schema) {
          for (let i = 0; i < fks.length; i++) {
            for (let j = 0; j < fks.length; j++) {
              if (i === j) continue;
              const fkA = fks[i];
              const fkB = fks[j];
              // Endpoint under fkA.foreignTable: /orders/by_order_id/:order_id/products
              endpoints.push({
                table: fkA.foreignTable,
                method: "GET",
                path: `/api/${connectionId}/${fkA.foreignTable}/by_${fkA.columnName}/:${fkA.columnName}/${fkB.foreignTable}`,
                description: `Get all ${fkB.foreignTable} for ${fkA.columnName} via ${tableName}`,
                params: [
                  { name: fkA.columnName, type: "path", desc: `Foreign key (${fkA.columnName})` },
                ],
                response: `200 OK ({ ${fkA.columnName}, ${fkB.foreignTable}: [...] })`,
                type: "REL",
                relationship: `${fkA.columnName} → ${fkB.foreignTable} via ${tableName}`,
              });
            }
          }
        }
   
        // For join tables with 2+ FKs, generate endpoints for each pair of FKs within the same table
        if (fks.length >= 2) {
          for (let i = 0; i < fks.length; i++) {
            for (let j = 0; j < fks.length; j++) {
              if (i === j) continue;
              const fkA = fks[i];
              const fkB = fks[j];
              endpoints.push({
                table: tableName,
                method: "GET",
                path: `/api/${connectionId}/${tableName}/by_${fkA.columnName}/:${fkA.columnName}/by_${fkB.columnName}/:${fkB.columnName}`,
                description: `Get ${tableName} by ${fkA.columnName} and ${fkB.columnName}`,
                params: [
                  { name: fkA.columnName, type: "path", desc: `Foreign key (${fkA.columnName})` },
                  { name: fkB.columnName, type: "path", desc: `Foreign key (${fkB.columnName})` },
                ],
                response: "200 OK",
                type: "REL",
                relationship: `${tableName} by ${fkA.columnName} and ${fkB.columnName}`,
              });
            }
          }
        }
   
    // Multi-join endpoints (up to 3 tables)
    const fks2 = tableInfo.foreignKeys || [];
    if (fks2.length >= 1 && schema) {
      // Recursively build join paths up to 3 tables
      const buildJoinEndpoints = (path, tables, params, depth) => {
        if (depth > 2) return;
        const lastTable = tables[tables.length - 1];
        const lastFks = schema[lastTable]?.foreignKeys || [];
        for (const fk of lastFks) {
          if (tables.includes(fk.foreignTable)) continue;
          const newPath = `${path}/by_${fk.columnName}/:${fk.columnName}/${fk.foreignTable}`;
          const newParams = [
            ...params,
            {
              name: fk.columnName,
              type: "path",
              desc: `Foreign key (${fk.columnName})`,
            },
            {
              name: "joinType",
              type: "query",
              desc: "Join type: inner (default), left, right, full",
            },
          ];
          endpoints.push({
            table: tableName,
            method: "GET",
            path: `/api/${connectionId}${newPath}`,
            description: `Multi-join: ${tables.join(" → ")} → ${
              fk.foreignTable
            } (supports joinType query param)`,
            params: newParams,
            response: "200 OK",
            type: "REL",
            relationship: `Multi-join: ${tables.join(" → ")} → ${
              fk.foreignTable
            }`,
          });
          buildJoinEndpoints(
            newPath,
            [...tables, fk.foreignTable],
            newParams,
            depth + 1
          );
        }
      };
      buildJoinEndpoints(`/${tableName}`, [tableName], [], 1);
    }

    // Relationship endpoints: for each FK, generate a unique endpoint using the FK column
    tableInfo.foreignKeys?.forEach((fk) => {
      endpoints.push({
        table: tableName,
        method: "GET",
        path: `/api/${connectionId}/${tableName}/by_${fk.columnName}/:${fk.columnName}/${fk.foreignTable}`,
        description: `Get related ${fk.foreignTable} for ${tableName} by ${fk.columnName}`,
        params: [
          {
            name: fk.columnName,
            type: "path",
            desc: `Foreign key (${fk.columnName})`,
          },
        ],
        response: "200 OK",
        type: "REL",
        relationship: `${tableName} → ${fk.foreignTable} via ${fk.columnName}`,
      });
    });
    tableInfo.reverseForeignKeys?.forEach((rfk) => {
      endpoints.push({
        table: tableName,
        method: "GET",
        path: `/api/${connectionId}/${tableName}/by_${rfk.referencedColumn}/:${rfk.referencedColumn}/${rfk.referencingTable}`,
        description: `Get all ${rfk.referencingTable} for ${tableName} by ${rfk.referencedColumn}`,
        params: [
          {
            name: rfk.referencedColumn,
            type: "path",
            desc: `Referenced key (${rfk.referencedColumn})`,
          },
        ],
        response: "200 OK",
        type: "REL",
        relationship: `${tableName} ← ${rfk.referencingTable} via ${rfk.referencedColumn}`,
      });
    });

    return endpoints;
  };

  // Quick stats
  const stats = useMemo(() => {
    if (!schema) return { total: 0, crud: 0, rel: 0, tables: 0 };
    let total = 0,
      crud = 0,
      rel = 0;
    Object.entries(schema).forEach(([table, info]) => {
      const eps = generateEndpoints(table, info);
      total += eps.length;
      crud += eps.filter((e) => e.type === "CRUD").length;
      rel += eps.filter((e) => e.type === "REL").length;
    });
    return { total, crud, rel, tables: Object.keys(schema).length };
  }, [schema]);

  // Table list for filter
  const tableList = useMemo(
    () => (schema ? Object.keys(schema) : []),
    [schema]
  );

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

  // Endpoint filter
  const filterEndpoints = (eps) => {
    return eps.filter(
      (e) =>
        (methodFilter === "ALL" || e.method === methodFilter) &&
        (typeFilter === "ALL" || e.type === typeFilter)
    );
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          All available endpoints for <b>{schema && Object.keys(schema)[0]}</b>
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>HTTP Method</InputLabel>
            <Select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              label="HTTP Method"
            >
              {HTTP_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>API Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="API Type"
            >
              {API_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Table</InputLabel>
            <Select
              multiple
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              input={<OutlinedInput label="Table" />}
              renderValue={(selected) => selected.join(", ")}
            >
              {tableList.map((t) => (
                <MenuItem key={t} value={t}>
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
        // Only show cross-table endpoints under referenced tables, not join tables
        let endpoints = filterEndpoints(generateEndpoints(tableName, tableInfo));
        // For referenced tables, add cross-table endpoints from join tables
        if (schema) {
          Object.entries(schema).forEach(([joinTable, joinInfo]) => {
            const joinFks = joinInfo.foreignKeys || [];
            if (joinFks.length >= 2) {
              for (let i = 0; i < joinFks.length; i++) {
                for (let j = 0; j < joinFks.length; j++) {
                  if (i === j) continue;
                  const fkA = joinFks[i];
                  const fkB = joinFks[j];
                  if (fkA.foreignTable === tableName) {
                    endpoints.push({
                      table: tableName,
                      method: "GET",
                      path: `/api/${connectionId}/${fkA.foreignTable}/by_${fkA.columnName}/:${fkA.columnName}/${fkB.foreignTable}`,
                      description: `Get all ${fkB.foreignTable} for ${fkA.columnName} via ${joinTable}`,
                      params: [
                        { name: fkA.columnName, type: "path", desc: `Foreign key (${fkA.columnName})` },
                      ],
                      response: `200 OK ({ ${fkA.columnName}, ${fkB.foreignTable}: [...] })`,
                      type: "REL",
                      relationship: `${fkA.columnName} → ${fkB.foreignTable} via ${joinTable}`,
                    });
                  }
                }
              }
            }
          });
        }
        if (endpoints.length === 0) return null;
        const isExpanded = expandedTable === tableName;
        return (
          <Box key={tableName} sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 2,
                bgcolor: "grey.100",
                borderRadius: 1,
                cursor: "pointer",
              }}
              onClick={() => setExpandedTable(isExpanded ? null : tableName)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h6">{tableName}</Typography>
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
                        Relationship: {endpoint.relationship}
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
