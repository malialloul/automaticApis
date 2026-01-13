import React, { useMemo, useState, useEffect } from "react";
import { Box, Typography, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, TableContainer } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useConnection } from "../../_shared/database/useConnection";
import { getConnection, loadConnections, saveConnection } from "../../utils/storage";
import { getConnections, getSchema, introspectConnection } from "../../services/api";
import { NoConnections } from "../../layout/ConsoleLayout/NoConnections";
import { LISTENERS } from "../../_shared/listeners";
import { ConnectionsDetails } from "./ConnectionsDetails/ConnectionsDetails";


export default function DashboardPage() {
  const location = useLocation();
  const { currentConnection, schema, selectConnection, deleteConnection, updateSchema } = useConnection();
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [connections, setConnections] = useState([]);
  const [activeIds, setActiveIds] = useState([]);
  const [statsById, setStatsById] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [scope, setScope] = useState('current');
  const [confirm, setConfirm] = useState({ open: false, type: null, target: null });
  const [hasAutoRefreshed, setHasAutoRefreshed] = useState(false);

  useEffect(() => {
    if (location.state?.notice) setNotice(location.state.notice);
  }, [location.state]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
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

  // Load active connections and their stats
  const loadActive = async () => {
    try {
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
    }
  };

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

  useEffect(() => {
    const refreshConnections = () => setConnections(loadConnections());
    refreshConnections();
    window.addEventListener('connections-changed', refreshConnections);
    return () => window.removeEventListener('connections-changed', refreshConnections);
  }, []);

  //get active connections and their stats
  useEffect(() => {

    loadActive();
    const reloader = () => loadActive();
    window.addEventListener(LISTENERS.CONNECTIONS_CHANGED, reloader);
    window.addEventListener(LISTENERS.CONNECTION_UPDATED, reloader);
    return () => {
      window.removeEventListener(LISTENERS.CONNECTIONS_CHANGED, reloader);
      window.removeEventListener(LISTENERS.CONNECTION_UPDATED, reloader);
    };
  }, [connections]);

  // Set default scope
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
    for (const id of idSet) {
      const conn = (connections || []).find((c) => c.id === id) || (currentConnection?.id === id ? currentConnection : null);
      if (!conn) continue;
      try {
        await introspectConnection(id, {
          host: conn.host,
          port: parseInt(conn.port, 10),
          database: conn.database,
          user: conn.user,
          password: conn.password,
          type: conn.type,
        });
        const nowIso = new Date().toISOString();
        const saved = getConnection(id);
        if (saved) {
          saveConnection({ ...saved, introspectedAt: nowIso });
        }
        const schemaData = await getSchema(id);
        if (currentConnection?.id === id) {
          updateSchema(schemaData);
        }
      } catch (e) {
        window.dispatchEvent(
          new CustomEvent('toast', { detail: { message: `Failed to refresh ${conn?.name || conn?.database || id}`, severity: 'error' } })
        );
      }
    }
    // After refreshing, reload stats for all connections
    await loadActive();
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
    window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Schema refreshed', severity: 'success' } }));
  };

  return (
    <Box>
      {notice && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}

      <Box sx={{ p: 3 }}>
        <ConnectionsDetails refreshSchemas={refreshSchemas} setConfirm={setConfirm} connections={connections} scope={scope} setScope={setScope} displayStats={displayStats} loadingStats={loadingStats} statsById={statsById} />
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
                  const mod = await import('../../services/api');
                  await mod.closeConnection(target.id);
                } catch { }
                if (currentConnection?.id === target.id) selectConnection(null);
                window.dispatchEvent(new CustomEvent('connections-changed'));
                window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Disconnected from database', severity: 'success' } }));
              }
            }}>Confirm</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box >
  );
}
