import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Grid, Paper, Typography, TextField, Stack, Tooltip, IconButton, Divider, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import { getSchema } from '../services/api';

const TypeChip = ({ type }) => {
  const t = (type || '').toLowerCase();
  let color = '#e5e7eb';
  let fg = '#111827';
  if (t.includes('char') || t.includes('text')) { color = '#dbeafe'; fg = '#1e40af'; }
  else if (t.includes('int') || t.includes('num')) { color = '#fee2e2'; fg = '#991b1b'; }
  else if (t.includes('timestamp') || t.includes('date')) { color = '#fef3c7'; fg = '#92400e'; }
  else if (t.includes('bool')) { color = '#dcfce7'; fg = '#166534'; }
  return <Box sx={{ display: 'inline-block', px: 1, py: 0.25, bgcolor: color, color: fg, borderRadius: 1, fontSize: 12 }}>{type}</Box>;
};

const Badge = ({ label, color }) => (
  <Box sx={{ display: 'inline-block', px: 1, py: 0.25, bgcolor: color || '#f3f4f6', color: '#111827', borderRadius: 1, fontSize: 12 }}>{label}</Box>
);

const CopyButton = ({ text }) => (
  <Tooltip title="Copy">
    <IconButton size="small" onClick={() => navigator.clipboard.writeText(text)}>
      <span role="img" aria-label="copy">📋</span>
    </IconButton>
  </Tooltip>
);

const SchemaExplorer = ({ connection }) => {
  const connectionId = connection?.id;
  const connectionName = connection?.name || connectionId || 'Connection';

  const [schema, setSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'grid'
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!connectionId) return;
      try {
        const s = await getSchema(connectionId);
        setSchema(s);
        const tnames = Object.keys(s || {}).sort();
        setTables(tnames);
        setSelected(tnames[0] || null);
      } catch (e) {
        console.error('Schema load failed', e);
      }
    };
    load();
  }, [connectionId]);

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(t => t.toLowerCase().includes(q));
  }, [tables, query]);

  const tableInfo = selected ? schema?.[selected] : null;

  const handleRefresh = async () => {
    if (!connectionId) return;
    try {
      const s = await getSchema(connectionId);
      setSchema(s);
      const tnames = Object.keys(s || {}).sort();
      setTables(tnames);
      if (!tnames.includes(selected)) setSelected(tnames[0] || null);
    } catch (e) { console.error('Schema refresh failed', e); }
  };

  const handleExportTableSchema = () => {
    if (!tableInfo) return;
    const blob = new Blob([JSON.stringify(tableInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected}-schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#6b7280' }}>{connectionName} &gt; Schema</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Schema Explorer</Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="outlined" onClick={handleRefresh}>Refresh Schema</Button>
          <TextField size="small" placeholder="Search tables" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Stack direction="row" spacing={1}>
            <Button variant={view === 'list' ? 'contained' : 'outlined'} size="small" onClick={() => setView('list')}>List</Button>
            <Button variant={view === 'grid' ? 'contained' : 'outlined'} size="small" onClick={() => setView('grid')}>Grid</Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {/* Left Sidebar */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>Tables</Typography>
            <Divider sx={{ mb: 1 }} />
            {view === 'list' ? (
              <Box>
                {filteredTables.map(t => (
                  <Box key={t} onClick={() => setSelected(t)} sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    p: 1, mb: 0.5, borderRadius: 1, cursor: 'pointer',
                    bgcolor: selected === t ? '#eff6ff' : 'transparent',
                    '&:hover': { bgcolor: selected === t ? '#eff6ff' : '#f9fafb' }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span role="img" aria-label="table">📋</span>
                      <Typography variant="body2" sx={{ fontWeight: selected === t ? 600 : 400 }}>{t}</Typography>
                    </Box>
                    <Chip label={(schema?.[t]?.columns || []).length} size="small" />
                  </Box>
                ))}
              </Box>
            ) : (
              <Grid container spacing={1}>
                {filteredTables.map(t => (
                  <Grid item xs={6} key={t}>
                    <Paper onClick={() => setSelected(t)} sx={{ p: 1, cursor: 'pointer', border: selected === t ? '2px solid #3b82f6' : '1px solid #e5e7eb' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: selected === t ? 600 : 500 }}>{t}</Typography>
                        <Chip label={(schema?.[t]?.columns || []).length} size="small" />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            {!tableInfo ? (
              <Typography variant="body1">Select a table to view details.</Typography>
            ) : (
              <Box>
                {/* Table Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{selected}</Typography>
                    {tableInfo.description && (
                      <Typography variant="body2" sx={{ color: '#6b7280' }}>{tableInfo.description}</Typography>
                    )}
                    {/* Row count not available in current schema; placeholder */}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small">View Data</Button>
                    <Button variant="outlined" size="small">Generate API</Button>
                    <Button variant="outlined" size="small" onClick={handleExportTableSchema}>Export Schema</Button>
                  </Stack>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Columns Table */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Columns</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Nullable</TableCell>
                      <TableCell>Default</TableCell>
                      <TableCell>Key</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(tableInfo.columns || []).map(col => {
                      const isPK = (tableInfo.primaryKeys || []).includes(col.name);
                      const fk = (tableInfo.foreignKeys || []).find(f => f.columnName === col.name);
                      return (
                        <TableRow key={col.name} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2" sx={{ fontWeight: isPK ? 700 : 500, color: isPK ? '#b45309' : 'inherit' }}>{col.name}</Typography>
                              <CopyButton text={col.name} />
                            </Stack>
                          </TableCell>
                          <TableCell><TypeChip type={col.type} /></TableCell>
                          <TableCell>{col.nullable ? '✅' : '❌'}</TableCell>
                          <TableCell>{col.default || '—'}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              {isPK && <Badge label="🔑 PK" color="#fef3c7" />}
                              {fk && <Badge label={`🔗 FK → ${fk.foreignTable}.${fk.foreignColumn}`} color="#dbeafe" />}
                              {/* Index/Unique info not available in current API */}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <CopyButton text={`${selected}.${col.name}`} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Relationships Section */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>Relationships</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Foreign Keys</Typography>
                      <Stack spacing={1}>
                        {(tableInfo.foreignKeys || []).length === 0 && (
                          <Typography variant="body2" sx={{ color: '#6b7280' }}>No foreign keys</Typography>
                        )}
                        {(tableInfo.foreignKeys || []).map((fk, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Badge label={fk.columnName} color="#dbeafe" />
                            <Typography variant="body2">→ {fk.foreignTable}.{fk.foreignColumn}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Referenced By</Typography>
                      <Stack spacing={1}>
                        {(tableInfo.reverseForeignKeys || []).length === 0 && (
                          <Typography variant="body2" sx={{ color: '#6b7280' }}>No referencing tables</Typography>
                        )}
                        {(tableInfo.reverseForeignKeys || []).map((rfk, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">{rfk.referencingTable}.{rfk.referencingColumn} → {selected}.{rfk.referencedColumn}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Indexes Section (placeholder) */}
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>Indexes</Typography>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" sx={{ color: '#6b7280' }}>Index metadata is not available in the current API.</Typography>
                </Paper>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} md={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Quick Stats</Typography>
            {tableInfo ? (
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Columns</Typography>
                  <Typography variant="body2">{(tableInfo.columns || []).length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Primary Keys</Typography>
                  <Typography variant="body2">{(tableInfo.primaryKeys || []).length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Foreign Keys</Typography>
                  <Typography variant="body2">{(tableInfo.foreignKeys || []).length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Indexes</Typography>
                  <Typography variant="body2">—</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Estimated Rows</Typography>
                  <Typography variant="body2">—</Typography>
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: '#6b7280' }}>Select a table</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default SchemaExplorer;