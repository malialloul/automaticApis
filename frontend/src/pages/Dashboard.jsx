import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Grid, Button, Alert, Chip, Tooltip, Skeleton, ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, TableContainer } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ApiIcon from "@mui/icons-material/Api";
import TableChartIcon from "@mui/icons-material/TableChart";
import LinkIcon from "@mui/icons-material/Link";
import StorageIcon from "@mui/icons-material/Storage";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useNavigate, useLocation } from "react-router-dom";
import { useConnection } from "../hooks/useConnection";
import { loadConnections, getConnection, saveConnection } from "../utils/storage";
import { getConnections, getSchema, introspectConnection } from "../services/api";

const StatCard = ({ title, value, icon, color = "primary" }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: 2,
      bgcolor: "#1E293B",
      border: "1px solid #334155",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box sx={{ color: `${color}.main` }}>{icon}</Box>
      <Box>
        <Typography variant="h5" fontWeight={700} color="#F8FAFC">
          {value}
        </Typography>
        <Typography variant="body2" color="#94A3B8">
          {title}
        </Typography>
      </Box>
    </Box>
  </Box>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentConnection, schema, selectConnection, deleteConnection, updateSchema } = useConnection();
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [connections, setConnections] = useState([]);
  const [activeIds, setActiveIds] = useState([]);
  const [statsById, setStatsById] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [scope, setScope] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, type: null, target: null });
  const [refreshing, setRefreshing] = useState(false);
  const [rowRefreshing, setRowRefreshing] = useState({});
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);
  const [lastSyncedById, setLastSyncedById] = useState({});

  useEffect(() => {
    if (location.state?.notice) setNotice(location.state.notice);
  }, [location.state]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const tables = useMemo(() => (schema ? Object.keys(schema) : []), [schema]);
  const stats = useMemo(() => {
    if (!schema) return null;
    const tableCount = Object.keys(schema).length;
    let columnCount = 0;
    let fkCount = 0;
    let reverseFkCount = 0;
    Object.values(schema).forEach((t) => {
      columnCount += t.columns?.length || 0;
      fkCount += t.foreignKeys?.length || 0;
      reverseFkCount += t.reverseForeignKeys?.length || 0;
    });
    const endpointCount = tableCount * 5 + fkCount + reverseFkCount;
    return { tableCount, columnCount, relationshipCount: fkCount + reverseFkCount, endpointCount };
  }, [schema]);

  const aggregateStats = useMemo(() => {
    const ids = (connections || []).map((c) => c.id);
    if (!ids.length) return null;
    let tableCount = 0;
    let columnCount = 0;
    let relationshipCount = 0;
    let endpointCount = 0;
    let any = false;
    ids.forEach((id) => {
      const s = statsById[id];
      if (s) {
        any = true;
        tableCount += s.tableCount || 0;
        columnCount += s.columnCount || 0;
        relationshipCount += s.relationshipCount || 0;
        endpointCount += s.endpointCount || 0;
      }
    });
    if (!any) {
      // Fallback to current schema stats when per-connection stats are not yet available
      return stats || null;
    }
    return { tableCount, columnCount, relationshipCount, endpointCount };
  }, [connections, statsById, stats]);

  const displayStats = scope === 'all' ? aggregateStats : stats;

  // Keep schema in sync when switching selected connection
  useEffect(() => {
    const loadCurrentSchema = async () => {
      if (!currentConnection?.id) {
        updateSchema(null);
        return;
      }
      try {
        const data = await getSchema(currentConnection.id);
        updateSchema(data);
      } catch (e) {
        updateSchema(null);
      }
    };
    loadCurrentSchema();
  }, [currentConnection?.id]);

  const showEmpty = !currentConnection;
  useEffect(() => {
    const refreshConnections = () => setConnections(loadConnections());
    refreshConnections();
    window.addEventListener('connections-changed', refreshConnections);
    return () => window.removeEventListener('connections-changed', refreshConnections);
  }, []);

  // Keep last synced map in sync with saved connections metadata
  useEffect(() => {
    const map = {};
    (connections || []).forEach((c) => {
      if (c.introspectedAt) map[c.id] = c.introspectedAt;
    });
    setLastSyncedById(map);
  }, [connections]);

  useEffect(() => {
    const loadActive = async () => {
      try {
        setLoadingConnections(true);
        const details = await getConnections();
        const active = Array.isArray(details) ? details.map((d) => d.id) : [];
        setActiveIds(active);
        const ids = (connections || []).map((c) => c.id);
        if (ids.length > 0) {
          setLoadingStats(true);
          // Fetch schema for each active id to compute stats
          for (const id of ids) {
            try {
              const schemaData = await getSchema(id);
              // Compute stats for this schema
              const tableCount = Object.keys(schemaData || {}).length;
              let columnCount = 0;
              let fk = 0;
              let rfk = 0;
              Object.values(schemaData || {}).forEach((t) => {
                columnCount += t.columns?.length || 0;
                fk += t.foreignKeys?.length || 0;
                rfk += t.reverseForeignKeys?.length || 0;
              });
              const endpointCount = tableCount * 5 + fk + rfk;
              setStatsById((prev) => ({
                ...prev,
                [id]: {
                  tableCount,
                  columnCount,
                  relationshipCount: fk + rfk,
                  endpointCount,
                },
              }));
            } catch (e) {
              // Schema not available; leave stats undefined
            }
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoadingStats(false);
        setLoadingConnections(false);
      }
    };
    loadActive();
    const reloader = () => loadActive();
    window.addEventListener('connections-changed', reloader);
    window.addEventListener('connection-updated', reloader);
    return () => {
      window.removeEventListener('connections-changed', reloader);
      window.removeEventListener('connection-updated', reloader);
    };
  }, [connections]);

  useEffect(() => {
    if (!scope) {
      setScope(currentConnection ? 'current' : 'all');
    }
    if (scope === 'current' && !currentConnection) {
      setScope('all');
    }
  }, [currentConnection, scope]);

  // Auto-refresh schemas once on initial load so DB changes reflect after page reload
  useEffect(() => {
    if (hasAutoRefreshed) return;
    const ids = (scope === 'current' && currentConnection)
      ? [currentConnection.id]
      : (connections || []).map((c) => c.id);
    if (scope && ids.length > 0) {
      // Fire and forget; we gate with hasAutoRefreshed to avoid loops
      refreshSchemas(ids);
      setHasAutoRefreshed(true);
    }
  }, [scope, currentConnection, connections]);

  const refreshSchemas = async (ids) => {
    const idSet = Array.isArray(ids)
      ? ids
      : (scope === 'current' && currentConnection
          ? [currentConnection.id]
          : ((connections && connections.length) ? connections.map((c) => c.id)
              : (activeIds && activeIds.length) ? activeIds
              : currentConnection?.id ? [currentConnection.id] : []
            )
        );
    if (!idSet.length) return;
    setRefreshing(true);
    for (const id of idSet) {
      setRowRefreshing((prev) => ({ ...prev, [id]: true }));
      const conn = (connections || []).find((c) => c.id === id) || (currentConnection?.id === id ? currentConnection : null);
      if (!conn) continue;
      try {
        await introspectConnection(id, {
          host: conn.host,
          port: parseInt(conn.port, 10),
          database: conn.database,
          user: conn.user,
          password: conn.password,
          type: conn.type || 'postgres',
        });
        const nowIso = new Date().toISOString();
        setLastSyncedById((prev) => ({ ...prev, [id]: nowIso }));
        const saved = getConnection(id);
        if (saved) {
          saveConnection({ ...saved, introspectedAt: nowIso });
        }
        const schemaData = await getSchema(id);
        // Recompute stats
        const tableCount = Object.keys(schemaData || {}).length;
        let columnCount = 0;
        let fk = 0;
        let rfk = 0;
        Object.values(schemaData || {}).forEach((t) => {
          columnCount += t.columns?.length || 0;
          fk += t.foreignKeys?.length || 0;
          rfk += t.reverseForeignKeys?.length || 0;
        });
        const endpointCount = tableCount * 5 + fk + rfk;
        setStatsById((prev) => ({
          ...prev,
          [id]: {
            tableCount,
            columnCount,
            relationshipCount: fk + rfk,
            endpointCount,
          },
        }));
        if (currentConnection?.id === id) {
          updateSchema(schemaData);
        }
      } catch (e) {
        window.dispatchEvent(
          new CustomEvent('toast', { detail: { message: `Failed to refresh ${conn?.name || conn?.database || id}`, severity: 'error' } })
        );
      } finally {
        setRowRefreshing((prev) => ({ ...prev, [id]: false }));
      }
    }
    setRefreshing(false);
    window.dispatchEvent(new CustomEvent('connections-changed'));
    window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Schema refreshed', severity: 'success' } }));
  };

  return (
    <Box>
      {notice && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}

      {showEmpty ? (
        <Box
          sx={{
            bgcolor: "#0F172A",
            p: 6,
            minHeight: "calc(100vh - 64px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box sx={{ maxWidth: 800, textAlign: "center" }}>
            {/* Illustration */}
            <Box
              sx={{
                width: 180,
                height: 140,
                mx: "auto",
                opacity: 0.6,
                position: "relative",
                "& > div": { position: "absolute", borderRadius: 2 },
              }}
            >
              <Box sx={{ top: 0, left: 0, width: 100, height: 60, border: "2px dashed #475569" }} />
              <Box sx={{ top: 10, right: 0, width: 80, height: 40, border: "2px dashed #8B5CF6" }} />
              <Box sx={{ bottom: 0, left: 40, width: 120, height: 60, border: "2px dashed #475569" }} />
              <Box sx={{ bottom: 10, left: 10, width: 40, height: 20, border: "2px dashed #8B5CF6" }} />
            </Box>

            {/* Heading */}
            <Typography sx={{ mt: 3, color: "#F1F5F9", fontWeight: 600, fontSize: 28 }}>
              No connections yet
            </Typography>
            {/* Subtext */}
            <Typography sx={{ mt: 1.5, color: "#94A3B8", maxWidth: 480, mx: "auto", lineHeight: 1.6, fontSize: 16 }}>
              Connect to your first database to see analytics, tables, and generated APIs here
            </Typography>

            {/* Primary CTA */}
            <Button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-add-connection'));
              }}
              sx={{
                mt: 4,
                width: 240,
                height: 48,
                borderRadius: 2,
                background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 16,
                 boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                transform: "scale(1)",
                transition: "transform 200ms ease, box-shadow 200ms ease",
                "&:hover": { transform: "scale(1.03)", boxShadow: "0 6px 16px rgba(139, 92, 246, 0.4)" },
              }}
              variant="contained"
              startIcon={<AddIcon />}
            >
              + Connect Database
            </Button>
            {/* Secondary link */}
            <Button onClick={() => navigate("/dashboard?sample=true")} sx={{ mt: 2, color: "#8B5CF6", fontWeight: 500 }}>
              View sample dashboard →
            </Button>

            {/* Subheading */}
            <Typography sx={{ mt: 6, mb: 3, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, fontSize: 14 }}>
              Once connected, you'll see:
            </Typography>

            {/* Preview Grid */}
            <Grid container spacing={2}>
              {[
                { icon: "📊", label: "Database Stats", text: "3 databases, 47 tables" },
                { icon: "⚡", label: "Generated APIs", text: "235 endpoints ready" },
                { icon: "⏱️", label: "Recent Activity", text: "Your latest actions" },
              ].map((card, idx) => (
                <Grid key={idx} item xs={12} sm={6} md={4}>
                  <Box sx={{ bgcolor: "#1E293B", border: "1px dashed #334155", borderRadius: 3, p: 2.5, opacity: 0.7, textAlign: "left" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ fontSize: 20 }}>{card.icon}</Box>
                      <Typography sx={{ color: "#94A3B8", fontWeight: 500, fontSize: 12 }}>{card.label}</Typography>
                    </Box>
                    <Typography sx={{ mt: 1, color: "#64748B", fontSize: 14 }}>{card.text}</Typography>
                    <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                      <Box sx={{ width: 24, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                      <Box sx={{ width: 16, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                      <Box sx={{ width: 32, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Quick Start Guide */}
            <Box sx={{ mt: 6, mx: "auto", maxWidth: 600, bgcolor: "#1E293B", borderLeft: "3px solid #8B5CF6", borderRadius: 2, p: 3, textAlign: "left" }}>
              <Typography sx={{ color: "#F1F5F9", fontWeight: 600, fontSize: 18 }}>🚀 Quick Start Guide</Typography>
              <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                {[
                  "Click '+ Connect Database' above",
                  "Enter your database credentials (stored locally in your browser)",
                  "We'll introspect your schema and generate APIs automatically",
                  "Start exploring your data, APIs, and documentation",
                ].map((step, idx) => (
                  <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#8B5CF6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      {idx + 1}
                    </Box>
                    <Typography sx={{ color: "#CBD5E1", fontSize: 14 }}>{step}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Feature Highlights */}
            <Box sx={{ mt: 6, mx: "auto", maxWidth: 600 }}>
              <Grid container spacing={3}>
                {[
                  { icon: "⚡", title: "Instant Setup", desc: "Under 60 seconds from connection to working APIs" },
                  { icon: "🔒", title: "Privacy First", desc: "Credentials never leave your browser" },
                  { icon: "🌍", title: "Multi-Language", desc: "Code generation in 9+ programming languages" },
                  { icon: "📊", title: "Auto Documentation", desc: "Swagger docs generated automatically" },
                ].map((f, idx) => (
                  <Grid key={idx} item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                      <Box sx={{ fontSize: 16 }}>{f.icon}</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, color: "#F8FAFC", fontSize: 13 }}>{f.title}</Typography>
                        <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>{f.desc}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Bottom Helper Banner */}
            <Box sx={{ mt: 6, mx: "auto", maxWidth: 700, p: 2.5, borderRadius: 2, background: "linear-gradient(90deg, #1E293B, rgba(30,41,59,0))", display: "flex", alignItems: "center", gap: 2 }}>
              <Box sx={{ fontSize: 20, color: "#8B5CF6" }}>🔒</Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                  Your database credentials are encrypted and stored locally. We never send them to our servers.
                </Typography>
              </Box>
              <Button sx={{ color: "#8B5CF6", textDecoration: "underline" }} onClick={() => navigate("/documentation")}>
                Learn more →
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          {/* Header Section */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography sx={{ fontSize: 32, fontWeight: 700, color: "#F1F5F9" }}>Dashboard</Typography>
              {currentConnection && (
                <Chip
                  label={`Viewing: ${currentConnection.name || currentConnection.database}`}
                  icon={<StorageIcon sx={{ color: "white !important" }} />}
                  onDelete={() => selectConnection(null)}
                  sx={{ bgcolor: "#8B5CF6", color: "white" }}
                />
              )}
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: 'center' }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={scope || (currentConnection ? 'current' : 'all')}
                onChange={(_, val) => val && setScope(val)}
                color="primary"
              >
                <ToggleButton value="current" disabled={!currentConnection}>Current</ToggleButton>
                <ToggleButton value="all">All</ToggleButton>
              </ToggleButtonGroup>
              <Button variant="outlined" disabled={refreshing} onClick={() => refreshSchemas()}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button>
            
            </Box>
          </Box>

          {/* Row 1: Key Metrics (from Connections page spec) */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                <TableChartIcon sx={{ fontSize: 24, color: "#3B82F6" }} />
                <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Tables</Typography>
                {displayStats ? (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.tableCount}</Typography>
                ) : loadingStats ? (
                  <Skeleton variant="text" width={80} height={48} />
                ) : (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                <StorageIcon sx={{ fontSize: 24, color: "#8B5CF6" }} />
                <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Total Columns</Typography>
                {displayStats ? (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.columnCount ?? '–'}</Typography>
                ) : loadingStats ? (
                  <Skeleton variant="text" width={80} height={48} />
                ) : (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                <LinkIcon sx={{ fontSize: 24, color: "#10B981" }} />
                <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Relationships</Typography>
                {displayStats ? (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.relationshipCount}</Typography>
                ) : loadingStats ? (
                  <Skeleton variant="text" width={80} height={48} />
                ) : (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                <ApiIcon sx={{ fontSize: 24, color: "#F59E0B" }} />
                <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>API Endpoints</Typography>
                {displayStats ? (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.endpointCount}</Typography>
                ) : loadingStats ? (
                  <Skeleton variant="text" width={80} height={48} />
                ) : (
                  <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Row 2: Database Breakdown */}
          <Typography sx={{ mt: 4, mb: 2, color: "#F1F5F9", fontSize: 20, fontWeight: 600 }}>{scope === 'all' ? 'Connected Databases' : 'Selected Database'}</Typography>
          <TableContainer>
            {connections.length === 0 ? (
              <Box sx={{ p: 4, textAlign: "center", color: "#94A3B8" }}>No connections</Box>
            ) : (
              <Table size="small" sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow sx={{ borderBottom: '1px solid #334155' }}>
                      {[
                        "Database",
                        "Type",
                        "Tables",
                        "APIs",
                        "Status",
                        "Last Synced",
                        "Actions",
                      ].map((h, i) => (
                        <TableCell key={i} sx={{ color: "#94A3B8", fontWeight: 600, fontSize: 13 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(scope === 'current' && currentConnection
                      ? connections.filter((c) => c.id === currentConnection.id)
                      : connections
                          .slice()
                          .sort((a, b) => {
                            if (!currentConnection?.id) return 0;
                            const aIsCurrent = a.id === currentConnection.id;
                            const bIsCurrent = b.id === currentConnection.id;
                            if (aIsCurrent && !bIsCurrent) return -1;
                            if (!aIsCurrent && bIsCurrent) return 1;
                            return 0;
                          })
                    ).map((c) => (
                      <TableRow
                        key={c.id}
                        hover
                        onClick={() => selectConnection(c)}
                        sx={{ cursor: 'pointer', bgcolor: currentConnection?.id === c.id ? '#273244' : undefined, '&:hover': { bgcolor: currentConnection?.id === c.id ? '#273244' : '#334155' } }}
                      >
                        <TableCell>
                          <Box>
                            <Typography sx={{ color: "#F8FAFC", fontSize: 14, fontWeight: 500 }}>
                              {c.name || c.database}
                            </Typography>
                            <Typography sx={{ color: "#94A3B8", fontSize: 12 }}>{c.host}:{c.port}</Typography>
                            {statsById[c.id] === undefined && !loadingStats && (
                              <Typography sx={{ color: "#64748B", fontSize: 12, mt: 0.5 }}>Introspect to view stats</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={c.type || c.dbType || "Unknown"} size="small" sx={{ bgcolor: "#3B82F6", color: "white" }} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ color: "#F8FAFC", fontSize: 14 }}>
                            {loadingStats && statsById[c.id] === undefined ? (
                              <Skeleton variant="text" width={24} />
                            ) : (
                              statsById[c.id]?.tableCount ?? "—"
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ color: "#8B5CF6", fontSize: 14 }}>
                            {loadingStats && statsById[c.id] === undefined ? (
                              <Skeleton variant="text" width={24} />
                            ) : (
                              statsById[c.id]?.endpointCount ?? "—"
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: (scope === 'all' ? (currentConnection?.id === c.id ? "#10B981" : "#64748B") : "#10B981") }} />
                            <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                              {scope === 'all' ? (currentConnection?.id === c.id ? 'Connected' : 'Available') : 'Connected'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                            {lastSyncedById[c.id] ? new Date(lastSyncedById[c.id]).toLocaleString() : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <Tooltip title="Disconnect">
                              <span>
                                <Button size="small" disabled={!!rowRefreshing[c.id]} onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirm({ open: true, type: 'disconnect', target: c });
                                }} sx={{ bgcolor: "#334155" }}>
                                  <LinkOffIcon fontSize="small" />
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip title="Refresh schema">
                              <span>
                                <Button size="small" disabled={!!rowRefreshing[c.id]} onClick={(e) => { e.stopPropagation(); refreshSchemas([c.id]); }} sx={{ bgcolor: "#334155", minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {rowRefreshing[c.id] ? <CircularProgress size={16} sx={{ color: '#CBD5E1' }} /> : '🔄'}
                                </Button>
                              </span>
                            </Tooltip>
                            <Tooltip title="View details">
                              <span>
                                <Button size="small" disabled={!!rowRefreshing[c.id]} onClick={(e) => { e.stopPropagation(); navigate("/schema"); }} sx={{ bgcolor: "#334155" }}>👁️</Button>
                              </span>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <span>
                                <Button size="small" disabled={!!rowRefreshing[c.id]} onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirm({ open: true, type: 'delete', target: c });
                                }} sx={{ bgcolor: "#334155" }}>
                                  <DeleteIcon fontSize="small" />
                                </Button>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </TableContainer>

          {/* Confirm Dialog for Disconnect/Delete */}
          <Dialog open={confirm.open} onClose={() => setConfirm({ open: false, type: null, target: null })}>
            <DialogTitle>
              {confirm.type === 'delete' ? 'Delete Connection' : 'Disconnect Connection'}
            </DialogTitle>
            <DialogContent>
              <Typography>
                {currentConnection?.id === confirm.target?.id
                  ? 'You are currently connected to this database. Are you sure?'
                  : confirm.type === 'delete'
                  ? 'This will remove the saved connection locally.'
                  : 'This will close the backend session.'}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirm({ open: false, type: null, target: null })}>Cancel</Button>
              <Button color="error" onClick={async () => {
                const target = confirm.target;
                const type = confirm.type;
                setConfirm({ open: false, type: null, target: null });
                if (!target) return;
                if (type === 'delete') {
                  deleteConnection(target.id);
                  if (currentConnection?.id === target.id) selectConnection(null);
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Connection deleted', severity: 'success' } }));
                } else if (type === 'disconnect') {
                  try {
                    const mod = await import('../services/api');
                    await mod.closeConnection(target.id);
                  } catch {}
                  if (currentConnection?.id === target.id) selectConnection(null);
                  window.dispatchEvent(new CustomEvent('connections-changed'));
                  window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Disconnected from database', severity: 'success' } }));
                }
              }}>Confirm</Button>
            </DialogActions>
          </Dialog>

          {/* Row 3: Quick Actions */}
          <Grid container spacing={3} sx={{ mt: 3 }}>
            <Grid item xs={12} md={12}>
              <Typography sx={{ mb: 1.5, color: "#F1F5F9", fontWeight: 600, fontSize: 18 }}>Quick Actions</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box onClick={() => navigate("/documentation")} sx={{ cursor: "pointer", bgcolor: "#2A2F45", background: "linear-gradient(135deg, #8B5CF6, #3B82F6)", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "transform 120ms", "&:hover": { filter: "brightness(1.1)", transform: "scale(1.02)" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ fontSize: 28 }}>💻</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Generate Code</Typography>
                        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Get client code in any language</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 20 }}>→</Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box onClick={() => currentConnection && navigate("/apis")} sx={{ cursor: currentConnection ? "pointer" : "default", bgcolor: "#1E293B", border: "2px solid #8B5CF6", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: currentConnection ? 1 : 0.6 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ fontSize: 24, color: "#8B5CF6" }}>⚡</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>View All APIs</Typography>
                        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Browse generated endpoints</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 20 }}>→</Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box onClick={() => currentConnection && navigate("/documentation")} sx={{ cursor: currentConnection ? "pointer" : "default", bgcolor: "#1E293B", border: "2px solid #3B82F6", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: currentConnection ? 1 : 0.6 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ fontSize: 24, color: "#3B82F6" }}>📄</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Export Swagger</Typography>
                        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Download OpenAPI specification</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 20 }}>→</Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box onClick={() => navigate("/schema")} sx={{ cursor: "pointer", bgcolor: "#1E293B", border: "2px solid #10B981", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box sx={{ fontSize: 24, color: "#10B981" }}>🗺️</Box>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>View ER Diagram</Typography>
                        <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Visualize relationships</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 20 }}>→</Box>
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}
