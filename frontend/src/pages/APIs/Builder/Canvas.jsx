import React from 'react';
import { Box, Typography, Paper, IconButton, Chip, Button, TextField, Tooltip, alpha, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import FunctionsIcon from '@mui/icons-material/Functions';
import TableChartIcon from '@mui/icons-material/TableChart';

// Validate SQL identifier: must start with letter/underscore, contain only alphanumeric/_
const isValidSQLIdentifier = (str) => {
  if (!str || str.length === 0) return true; // empty is ok (will use default)
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
};

const Canvas = ({
  tables = [],
  schema = {},
  outputFields = {},
  joins = [],
  joinSuggestions = [],
  onAddJoin = () => {},
  onRemoveJoin = () => {},
  onToggleField = () => {},
  onRemoveTable = () => {},
  filters = [],
  onAddFilter = () => {},
  onRemoveFilter = () => {},
  groupBy = [],
  onAddGroup = () => {},
  onRemoveGroup = () => {},
  aggregates = [],
  having = [],
  onAddHaving = () => {},
  onRemoveHaving = () => {},
  onToggleJoinType = () => {},
  onAddAggregate = () => {},
  onRemoveAggregate = () => {},
  onSelectAllFields = () => {},
  openFilterFor,
  setOpenFilterFor,
  filterDraft,
  setFilterDraft,
  openAggFor,
  setOpenAggFor,
  aggDraft,
  setAggDraft,
  openGroupFor,
  setOpenGroupFor,
  groupDraft,
  setGroupDraft,
  openHavingFor,
  setOpenHavingFor,
  havingDraft,
  setHavingDraft,
}) => {
  const theme = useTheme();
  const ops = [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'in', label: 'in' },
    { value: 'like', label: 'contains' },
  ];
  const aggs = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Tip: add joins between tables if you want combined data (we auto-detect possible joins).
      </Typography>

      {joinSuggestions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {joinSuggestions.map((s, i) => (
            <Chip
              key={i}
              label={`Show related ${s.toTable} for each ${s.fromTable}`}
              onClick={() => onAddJoin({ ...s, type: 'LEFT' })}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ borderRadius: 2 }}
            />
          ))}
        </Box>
      )}

      {tables.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <TableChartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            Add a table from the left to start building your API.
          </Typography>
        </Box>
      )}
      {tables.map((t) => (
        <Paper key={t} variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TableChartIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>{t}</Typography>
            </Box>
            <IconButton size="small" onClick={() => onRemoveTable(t)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Active joins involving this table */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, flexWrap: 'wrap' }}>
            {joins.filter((j) => j.fromTable === t || j.toTable === t).map((j, idx) => {
              const label = j.fromTable === t ? `Show related ${j.toTable} (${j.type || 'LEFT'})` : `Include ${j.fromTable} for these ${j.toTable} (${j.type || 'LEFT'})`;
              return (
                <Chip
                  key={`${t}-join-${idx}`}
                  label={label}
                  color="info"
                  size="small"
                  onClick={() => onToggleJoinType && onToggleJoinType(j)}
                  onDelete={() => onRemoveJoin(j)}
                />
              );
            })}
          </Box>

          {/* Filters Section */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Filter the data before summarizing or calculating.">
                <Button 
                  size="small" 
                  variant="outlined"
                  startIcon={<FilterListIcon sx={{ fontSize: 16 }} />}
                  onClick={() => { setOpenFilterFor(t); setFilterDraft({ table: t, field: (outputFields[t] || [])[0] || null, op: 'eq', value: '' }); }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Add filter
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Filters Display */}
          {filters.filter(f => f.table === t).length > 0 && (
            <Paper variant="outlined" sx={{ mb: 2.5, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, display: 'block', color: 'warning.main' }}>
                <FilterListIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Filters
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {filters.filter(f => f.table === t).map(f => (
                  <Chip 
                    key={f.id} 
                    label={`${f.field} ${f.op} ${f.value}${f.exposedAsParam ? ' (param)' : ''}`} 
                    onDelete={() => onRemoveFilter(f.id)} 
                    color="warning"
                    variant="outlined"
                    sx={{ borderRadius: 2, height: 28 }}
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Group By Section */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Group data by this field to see summary information instead of individual rows.">
                <Button 
                  size="small" 
                  variant="outlined"
                  startIcon={<GroupWorkIcon sx={{ fontSize: 16 }} />}
                  onClick={() => { setOpenGroupFor(t); setGroupDraft({ table: t, field: (outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f))[0] || null }); }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Group by
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Group By Display */}
          {groupBy.filter(g => g.table === t).length > 0 && (
            <Paper variant="outlined" sx={{ mb: 2.5, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, display: 'block', color: 'info.main' }}>
                <GroupWorkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Grouped by
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {groupBy.filter(g => g.table === t).map(g => (
                  <Chip key={`${t}-group-${g.field}`} label={g.field} onDelete={() => onRemoveGroup(g)} color="info" sx={{ borderRadius: 2, height: 28 }} />
                ))}
              </Box>
            </Paper>
          )}

          {/* Summarize Section */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Add a calculation (SUM, COUNT, AVG, MIN, MAX).">
                <Button 
                  size="small" 
                  variant="outlined"
                  startIcon={<FunctionsIcon sx={{ fontSize: 16 }} />}
                  onClick={() => { setOpenAggFor(t); setAggDraft({ table: t, field: (outputFields[t] || [])[0] || '', func: 'COUNT' }); }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Add summary
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Summaries Display */}
          {aggregates.filter(a => a.table === t).length > 0 && (
            <Paper variant="outlined" sx={{ mb: 2.5, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5, display: 'block', color: 'success.main' }}>
                <FunctionsIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                Summaries
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {aggregates.filter(a => a.table === t).map(a => (
                  <Chip 
                    key={a.id} 
                    label={`${a.func}(${a.field})${a.alias ? ` as ${a.alias}` : ''}`} 
                    onDelete={() => onRemoveAggregate(a.id)} 
                    color="success"
                    sx={{ borderRadius: 2, height: 28 }}
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Filter summaries button */}
          {groupBy.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Tooltip title="Filter the summarized results after calculations.">
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => { setOpenHavingFor(t); setHavingDraft({ aggField: aggregates[0] ? (aggregates[0].alias || `${aggregates[0].func.toLowerCase()}_${aggregates[0].field}`) : '', op: '>=', value: '' }); }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Filter summaries
                </Button>
              </Tooltip>
            </Box>
          )}

          {/* Having rules */}
          {having && having.filter(h => h.table === t).map(h => (
            <Chip key={h.id} label={`Only show summaries where ${h.aggField} ${h.op} ${h.value}`} onDelete={() => onRemoveHaving(h.id)} sx={{ mb: 1.5, borderRadius: 2, height: 28 }} />
          ))}

          {openFilterFor === t && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.02) }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Filter:</Typography>
                <select value={filterDraft.field || ''} onChange={(e) => setFilterDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                  {(outputFields[t] || []).map(f => (
                    <option key={f} value={f} style={{ background: '#1e1e1e', color: '#fff' }}>{f}</option>
                  ))}
                </select>
                <select value={filterDraft.op} onChange={(e) => setFilterDraft((d) => ({ ...d, op: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                  {ops.map(o => <option key={o.value} value={o.value} style={{ background: '#1e1e1e', color: '#fff' }}>{o.label}</option>)}
                </select>
                <TextField 
                  size="small" 
                  placeholder="value (required)" 
                  value={filterDraft.value} 
                  onChange={(e) => setFilterDraft((d) => ({ ...d, value: e.target.value }))}
                  error={filterDraft.value === ''}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button 
                  size="small" 
                  variant="contained" 
                  disabled={!filterDraft.field || filterDraft.value === '' || (filterDraft.exposedAsParam && filterDraft.param && !isValidSQLIdentifier(filterDraft.param))}
                  onClick={() => { onAddFilter(filterDraft); setOpenFilterFor(null); }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Add
                </Button>
                <Button size="small" onClick={() => setOpenFilterFor(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                  <input type="checkbox" checked={filterDraft.exposedAsParam || false} onChange={(e) => setFilterDraft((d) => ({ ...d, exposedAsParam: e.target.checked }))} />
                  Expose as API parameter
                </label>
                {filterDraft.exposedAsParam && (
                  <TextField 
                    size="small" 
                    placeholder="param name (e.g., age, status)" 
                    value={filterDraft.param || ''} 
                    onChange={(e) => setFilterDraft((d) => ({ ...d, param: e.target.value }))}
                    error={filterDraft.param && !isValidSQLIdentifier(filterDraft.param)}
                    helperText={filterDraft.param && !isValidSQLIdentifier(filterDraft.param) ? 'Invalid name' : ''}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                )}
              </Box>
            </Paper>
          )}

          {openGroupFor === t && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Group by:</Typography>
                <select value={groupDraft.field || ''} onChange={(e) => setGroupDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                  {(outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f)).map(f => (
                    <option key={f} value={f} style={{ background: '#1e1e1e', color: '#fff' }}>{f}</option>
                  ))}
                </select>
                <Button size="small" variant="contained" disabled={!groupDraft.field} onClick={() => { onAddGroup({ table: t, field: groupDraft.field }); setOpenGroupFor(null); }} sx={{ borderRadius: 2, textTransform: 'none' }}>Add</Button>
                <Button size="small" onClick={() => setOpenGroupFor(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
              </Box>
            </Paper>
          )}

          {openAggFor === t && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.02) }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Calculation:</Typography>
                <select value={aggDraft.func} onChange={(e) => setAggDraft((d) => ({ ...d, func: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                  {aggs.map(g => <option key={g} value={g} style={{ background: '#1e1e1e', color: '#fff' }}>{g}</option>)}
                </select>
                <Typography variant="caption">of</Typography>
                <select value={aggDraft.field || ''} onChange={(e) => setAggDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                  {(outputFields[t] || []).map(f => (
                    <option key={f} value={f} style={{ background: '#1e1e1e', color: '#fff' }}>{f}</option>
                  ))}
                </select>
                <TextField 
                  size="small" 
                  placeholder="name it (optional)" 
                  value={aggDraft.alias || ''} 
                  onChange={(e) => setAggDraft((d) => ({ ...d, alias: e.target.value }))}
                  error={aggDraft.alias && !isValidSQLIdentifier(aggDraft.alias)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button 
                  size="small" 
                  variant="contained" 
                  disabled={!aggDraft.field || (aggDraft.alias && !isValidSQLIdentifier(aggDraft.alias))}
                  onClick={() => { 
                    onAddAggregate({ table: t, field: aggDraft.field, func: aggDraft.func, alias: aggDraft.alias }); 
                    setOpenAggFor(null); 
                  }}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  Add
                </Button>
                <Button size="small" onClick={() => setOpenAggFor(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
              </Box>
            </Paper>
          )}

          {openHavingFor === t && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              {aggregates.length === 0 ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption">No summaries yet. </Typography>
                  <Button size="small" variant="contained" onClick={() => { onAddAggregate({ table: t, field: 'id', func: 'COUNT' }); setOpenHavingFor(null); }} sx={{ borderRadius: 2, textTransform: 'none' }}>Add summary</Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Filter summaries:</Typography>
                  <select value={havingDraft.aggField || ''} onChange={(e) => setHavingDraft((d) => ({ ...d, aggField: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                    {aggregates.map(a => {
                      const fieldNameOnly = a.field.split('.').pop();
                      const aliasLabel = a.alias || `${a.func.toLowerCase()}_${fieldNameOnly}`;
                      return (
                        <option key={a.id} value={aliasLabel} style={{ background: '#1e1e1e', color: '#fff' }}>{a.alias || `${a.func.toLowerCase()}(${a.field})`}</option>
                      );
                    })}
                  </select>
                  <select value={havingDraft.op || '>='} onChange={(e) => setHavingDraft((d) => ({ ...d, op: e.target.value }))} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #555', background: '#1e1e1e', color: 'inherit' }}>
                    <option value=">=" style={{ background: '#1e1e1e', color: '#fff' }}>&gt;=</option>
                    <option value=">" style={{ background: '#1e1e1e', color: '#fff' }}>&gt;</option>
                    <option value="=" style={{ background: '#1e1e1e', color: '#fff' }}>=</option>
                    <option value="<" style={{ background: '#1e1e1e', color: '#fff' }}>&lt;</option>
                    <option value="<=" style={{ background: '#1e1e1e', color: '#fff' }}>&lt;=</option>
                  </select>
                  <TextField 
                    size="small" 
                    placeholder="value (required)" 
                    value={havingDraft.value} 
                    onChange={(e) => setHavingDraft((d) => ({ ...d, value: e.target.value }))}
                    error={havingDraft.value === ''}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <Button 
                    size="small" 
                    variant="contained" 
                    disabled={!havingDraft.aggField || havingDraft.value === ''}
                    onClick={() => { onAddHaving({ table: t, aggField: havingDraft.aggField, op: havingDraft.op, value: havingDraft.value }); setOpenHavingFor(null); }}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    Add
                  </Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)} sx={{ borderRadius: 2, textTransform: 'none' }}>Cancel</Button>
                </Box>
              )}
            </Paper>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
            <Tooltip title="Select all columns from this table.">
              <Button size="small" variant="outlined" onClick={() => onSelectAllFields(t)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                Select All
              </Button>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {((schema[t]?.columns) || []).slice(0, 50).map((c) => {
              const selected = (outputFields[t] || []).includes(c.name);
              return (
                <Tooltip key={c.name} title="Click to select/deselect this column.">
                  <Chip
                    label={c.name}
                    color={selected ? 'primary' : 'default'}
                    onClick={() => onToggleField(t, c.name)}
                    sx={{ borderRadius: 2, height: 28, fontSize: '0.8rem' }}
                  />
                </Tooltip>
              );
            })}
            {((schema[t]?.columns) || []).length > 50 && <Typography variant="caption" color="text.secondary">...more fields</Typography>}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default Canvas;