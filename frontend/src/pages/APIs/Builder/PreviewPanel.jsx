import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Paper, alpha, useTheme, Chip } from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';
import TableChartIcon from '@mui/icons-material/TableChart';
import { listRecords, previewGraph } from '../../../services/api';

// Naive preview that supports simple FK joins where primaryTable has a FK to a secondary table.
const PreviewPanel = ({ connectionId, primaryTable, outputFields = {}, joins = [], filters = [], groupBy = [], aggregates = [], having = [], openFilterFor, filterDraft, openAggFor, aggDraft, openGroupFor, groupDraft, openHavingFor, havingDraft, hasValidationErrors = false, compact = false }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState([]);
  const [error, setError] = useState(null);
  const [previewSql, setPreviewSql] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function fetchPreview() {
      // Skip preview if there are validation errors
      if (hasValidationErrors) {
        setRows([]);
        setCols([]);
        setError(null);
        return;
      }

      if (!connectionId || !primaryTable) {
        setRows([]);
        setCols([]);
        setError(null);
        return;
      }

      const hasSelectedFields = Object.values(outputFields).some(fields => fields && fields.length > 0);
      if (!hasSelectedFields) {
        setRows([]);
        setCols([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Normalize joins so we accept both { fromTable,.. } and { from: { table, field } } shapes
        const normalizedJoins = (joins || []).map((j) => {
          if (j && j.from && j.to) {
            return { fromTable: j.from.table, toTable: j.to.table, fromColumn: j.from.field, toColumn: j.to.field, type: j.type };
          }
          return { fromTable: j.fromTable || j.from, toTable: j.toTable || j.to, fromColumn: j.fromColumn || j.from_col || j.from, toColumn: j.toColumn || j.to_col || j.to, type: j.type };
        });

        // Build effective lists including drafts
        const effectiveFilters = [...filters];
        if (openFilterFor && filterDraft.table && filterDraft.field && filterDraft.value) {
          effectiveFilters.push({ ...filterDraft, id: 'draft' });
        }

        const effectiveGroupBy = [...groupBy];
        if (openGroupFor && groupDraft.table && groupDraft.field) {
          effectiveGroupBy.push(groupDraft);
        }

        const effectiveAggregates = [...aggregates];
        if (openAggFor && aggDraft.table && aggDraft.field && aggDraft.func) {
          effectiveAggregates.push({ ...aggDraft, id: 'draft' });
        }

        const effectiveHaving = [...having];
        if (openHavingFor && havingDraft.aggField && havingDraft.value) {
          effectiveHaving.push({ ...havingDraft, id: 'draft' });
        }

        // Build canonical graph for server preview and local fallback
        const graph = {
          source: { table: primaryTable },
          joins: normalizedJoins,
          outputFields: outputFields || {},
          filters: effectiveFilters || [],
          groupBy: (effectiveGroupBy || []).map(g => `${g.table}.${g.field}`),
          aggregations: (effectiveAggregates || []).map(a => ({ type: a.func, field: `${a.table}.${a.field}`, as: a.alias })),
          having: effectiveHaving || [],
        };

        // Prefer server-side preview if available
        try {
          const preview = await previewGraph(connectionId, graph, 5);
          if (preview && preview.rows) {
            setRows(preview.rows);
            setCols(preview.columns || Object.keys(preview.rows[0] || {}));
            setPreviewSql(preview.sql || null);
            // use server result; skip local fallback
            if (!mounted) return;
            setLoading(false);
            return;
          }
        } catch (e) {
          // show friendly message then fall back to client-side merging
          setPreviewSql(null);
          const serverMsg = e?.response?.data?.error || e?.message || 'Server preview unavailable';
          setError(`Server preview error: ${serverMsg} — using local preview.`);
        }

        const primaryRows = (await listRecords(connectionId, primaryTable, { limit: 5 })) || [];

        // Start with primary fields
        const primarySelected = (outputFields[primaryTable] && outputFields[primaryTable].length > 0) ? outputFields[primaryTable].map(f => `${primaryTable}.${f}`) : (primaryRows[0] ? Object.keys(primaryRows[0]) : []);

        let mergedRows = primaryRows.map((r) => ({ ...r }));
        let mergedCols = [...primarySelected];

        // apply table-level filters first
        const allFilters = graph.filters || [];
        function applyFilterToRows(rows, fil) {
          const { table, field, op, value } = fil;
          const fullKey = `${table}.${field}`;
          return rows.filter((row) => {
            const v = row[field] ?? row[fullKey] ?? row[field];
            if (v === undefined) return false;
            const sval = String(v);
            switch (op) {
              case 'eq': return sval === String(value);
              case 'neq': return sval !== String(value);
              case 'lt': return Number(v) < Number(value);
              case 'lte': return Number(v) <= Number(value);
              case 'gt': return Number(v) > Number(value);
              case 'gte': return Number(v) >= Number(value);
              case 'in': return (String(value).split(',').map(s => s.trim()).includes(sval));
              case 'like': return sval.toLowerCase().includes(String(value).toLowerCase());
              default: return true;
            }
          });
        }

        let filteredPrimaryRows = mergedRows;
        for (const f of allFilters.filter(ff => ff.table === primaryTable)) {
          filteredPrimaryRows = applyFilterToRows(filteredPrimaryRows, f);
        }
        mergedRows = filteredPrimaryRows;

        // For each join where primaryTable === fromTable, fetch related rows and merge
        for (const j of joins.filter((x) => x.fromTable === primaryTable)) {
          const { toTable, fromColumn, toColumn, type } = j;
          // collect unique values to fetch
          // collect unique values to fetch
          const vals = Array.from(new Set(primaryRows.map((r) => r[fromColumn]).filter((v) => v !== undefined && v !== null))).slice(0, 8);
          const valueMap = {};
          await Promise.all(vals.map(async (v) => {
            try {
              const res = await listRecords(connectionId, toTable, { [toColumn]: v, limit: 1 });
              if (res && res.length > 0) valueMap[String(v)] = res[0];
            } catch (e) {
              // ignore individual join fetch errors
            }
          }));

          // determine which fields to add from the joined table
          const selected = outputFields[toTable] && outputFields[toTable].length > 0 ? outputFields[toTable] : [];
          let joinCols = selected.length > 0 ? selected.map((c) => `${toTable}.${c}`) : [];

          // if no explicit selections, pick up to 3 non-key fields from the fetched row
          if (joinCols.length === 0) {
            const sample = Object.values(valueMap)[0] || {};
            joinCols = Object.keys(sample).filter((k) => k !== toColumn).slice(0, 3).map((c) => `${toTable}.${c}`);
          }

          // apply filters for joined table if present (simple filtering on fetched valueMap)
          const tableFilters = (graph.filters || []).filter(ff => ff.table === toTable);
          if (tableFilters.length > 0) {
            // prune valueMap to rows matching tableFilters
            Object.keys(valueMap).forEach(k => {
              const rec = valueMap[k];
              const keep = tableFilters.every(ff => {
                const val = rec && rec[ff.field];
                if (val === undefined) return false;
                switch (ff.op) {
                  case 'eq': return String(val) === String(ff.value);
                  case 'in': return String(ff.value).split(',').map(s=>s.trim()).includes(String(val));
                  case 'like': return String(val).toLowerCase().includes(String(ff.value).toLowerCase());
                  case 'gt': return Number(val) > Number(ff.value);
                  case 'lt': return Number(val) < Number(ff.value);
                  default: return true;
                }
              });
              if (!keep) delete valueMap[k];
            });
          }
          // append to mergedCols
          for (const jc of joinCols) if (!mergedCols.includes(jc)) mergedCols.push(jc);

          // merge into rows
          mergedRows = mergedRows.map((r) => {
            const key = String(r[fromColumn]);
            const joinRec = valueMap[key] || {};
            const prefixed = {};
            (joinCols || []).forEach((colName) => {
              const short = colName.split('.').slice(1).join('.');
              prefixed[colName] = joinRec ? joinRec[short] : '';
            });
            return { ...r, ...prefixed };
          });
        }

        // If grouping or aggregates present, do client-side group/aggregate for preview
        const groups = graph.groupBy || [];
        const aggs = graph.aggregates || [];
        if (groups.length > 0 || aggs.length > 0) {
          // compute grouping key
          const grouped = {};
          for (const r of mergedRows) {
            const key = groups.map(g => String(r[g.field] ?? r[`${g.table}.${g.field}`] ?? '')).join('|||');
            if (!grouped[key]) grouped[key] = { rows: [], keyVals: groups.map(g => r[g.field] ?? r[`${g.table}.${g.field}`] ?? '') };
            grouped[key].rows.push(r);
          }
          // build aggregated rows
          const aggRows = Object.values(grouped).map(g => {
            const out = {};
            groups.forEach((gr, i) => { out[`${gr.table}.${gr.field}`] = g.keyVals[i]; });
            for (const a of aggs) {
              const vals = g.rows.map(rr => Number(rr[a.field] ?? rr[`${a.table}.${a.field}`] ?? 0)).filter(v => !Number.isNaN(v));
              let val = null;
              switch (a.func) {
                case 'SUM': val = vals.reduce((s, x) => s + x, 0); break;
                case 'AVG': val = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0; break;
                case 'COUNT': val = g.rows.length; break;
                case 'MIN': val = vals.length ? Math.min(...vals) : null; break;
                case 'MAX': val = vals.length ? Math.max(...vals) : null; break;
                default: val = null;
              }
              out[a.alias || `${a.func.toLowerCase()}(${a.table}.${a.field})`] = val;
            }
            return out;
          });

          // apply having filters if present in graph
          const having = graph.having || [];
          const filteredAggRows = aggRows.filter((row) => {
            return having.every(h => {
              const v = row[h.aggField];
              if (v === undefined) return false;
              switch (h.op) {
                case '>': return Number(v) > Number(h.value);
                case '>=': return Number(v) >= Number(h.value);
                case '<': return Number(v) < Number(h.value);
                case '<=': return Number(v) <= Number(h.value);
                case '=': return String(v) === String(h.value);
                default: return true;
              }
            });
          });

          if (!mounted) return;
          setRows(filteredAggRows);
          setCols(groups.map(g => `${g.table}.${g.field}`).concat(aggs.map(a => a.alias || `${a.func.toLowerCase()}(${a.table}.${a.field})`)));
        } else {
          if (!mounted) return;
          setRows(mergedRows);
          setCols(mergedCols);
        }
      } catch (err) {
        if (!mounted) return;
        setError('Preview failed. Try simplifying your selection.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchPreview();
    return () => { mounted = false; };
  }, [connectionId, primaryTable, JSON.stringify(outputFields), JSON.stringify(joins), JSON.stringify(filters), JSON.stringify(groupBy), JSON.stringify(aggregates), JSON.stringify(having), openFilterFor, JSON.stringify(filterDraft), openAggFor, JSON.stringify(aggDraft), openGroupFor, JSON.stringify(groupDraft), openHavingFor, JSON.stringify(havingDraft), hasValidationErrors]);

  if (!primaryTable) {
    return (
      <Box sx={{ textAlign: 'center', py: compact ? 2 : 4 }}>
        <TableChartIcon sx={{ fontSize: compact ? 32 : 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary" variant={compact ? 'body2' : 'body1'}>
          Add a table to the canvas to see a preview.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2, 
          borderRadius: 2, 
          bgcolor: alpha(theme.palette.error.main, 0.05),
          borderColor: alpha(theme.palette.error.main, 0.2),
        }}
      >
        <Typography color="error" variant="body2">{error}</Typography>
      </Paper>
    );
  }

  const displayCols = cols && cols.length > 0 ? cols : (rows[0] ? Object.keys(rows[0]) : []);

  // Compact mode: just show the table, header is in parent
  if (compact) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Chip 
            label={`${rows.length} rows`} 
            size="small" 
            sx={{ 
              height: 22,
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: 'success.main',
            }} 
          />
          <Typography variant="caption" color="text.secondary">
            Showing up to 5 rows from <strong>{primaryTable}</strong>
          </Typography>
        </Box>
        <Paper 
          variant="outlined" 
          sx={{ 
            flex: 1, 
            overflow: 'hidden', 
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <Table size="small" stickyHeader sx={{ 
              minWidth: 'max-content',
              '& th': { 
                bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
                fontWeight: 600, 
                fontSize: '0.75rem',
                borderBottom: 2,
                borderColor: 'divider',
                whiteSpace: 'nowrap',
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }, 
              '& td': { fontSize: '0.8rem', py: 0.75, whiteSpace: 'nowrap' } 
            }}>
              <TableHead>
                <TableRow>
                  {displayCols.map((c) => (
                    <TableCell key={c}>{c.split('.').pop()}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayCols.length || 1}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: 'center' }}>
                        Select fields to see preview
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i} hover>
                      {displayCols.map((c) => (
                        <TableCell key={c}>{String(r[c] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PreviewIcon sx={{ color: 'success.main', fontSize: 20 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>Live Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            Showing up to 5 rows from <strong>{primaryTable}</strong>
          </Typography>
        </Box>
        <Chip 
          label={`${rows.length} rows`} 
          size="small" 
          sx={{ 
            ml: 'auto',
            height: 22,
            bgcolor: alpha(theme.palette.success.main, 0.1),
            color: 'success.main',
          }} 
        />
      </Box>
      <Paper 
        variant="outlined" 
        sx={{ 
          flex: 1, 
          overflow: 'hidden', 
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ overflow: 'auto', flex: 1 }}>
          <Table size="small" stickyHeader sx={{ 
            minWidth: 'max-content',
            '& th': { 
              bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
              fontWeight: 600, 
              fontSize: '0.75rem',
              borderBottom: 2,
              borderColor: 'divider',
              whiteSpace: 'nowrap',
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }, 
            '& td': { fontSize: '0.8rem', py: 1, whiteSpace: 'nowrap' } 
          }}>
            <TableHead>
              <TableRow>
                {displayCols.map((c) => (
                  <TableCell key={c}>{c.split('.').pop()}</TableCell>
                ))}
              </TableRow>
            </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={displayCols.length || 1}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No data to display — select fields to see preview
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={i} hover>
                  {displayCols.map((c) => (
                    <TableCell key={c}>{String(r[c] ?? '')}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
};

export default PreviewPanel;