import React from 'react';
import { Box, Typography, Paper, IconButton, Chip, Button, TextField, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" color="text.secondary">Tip: add joins between tables if you want combined data (we auto-detect possible joins).</Typography>

      {joinSuggestions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
          {joinSuggestions.map((s, i) => (
            <Chip
              key={i}
              label={`Show related ${s.toTable} for each ${s.fromTable}`}
              onClick={() => onAddJoin({ ...s, type: 'LEFT' })}
              size="small"
            />
          ))}
        </Box>
      )}

      {tables.length === 0 && <Typography color="text.secondary">Drag or add a table from the left to start building your API.</Typography>}
      {tables.map((t) => (
        <Paper key={t} sx={{ p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">{t}</Typography>
            <IconButton size="small" onClick={() => onRemoveTable(t)}><CloseIcon fontSize="small" /></IconButton>
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
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Filter the data before summarizing or calculating.">
                <Button size="small" onClick={() => { setOpenFilterFor(t); setFilterDraft({ table: t, field: (outputFields[t] || [])[0] || null, op: 'eq', value: '' }); }}>
                  + Add filter
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Filters Display */}
          {filters.filter(f => f.table === t).length > 0 && (
            <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>Filters:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {filters.filter(f => f.table === t).map(f => (
                  <Chip 
                    key={f.id} 
                    label={`${f.field} ${f.op} ${f.value}${f.exposedAsParam ? ' (param)' : ''}`} 
                    size="small" 
                    onDelete={() => onRemoveFilter(f.id)} 
                    color="default"
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Group By Section */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Group data by this field to see summary information instead of individual rows.">
                <Button size="small" onClick={() => { setOpenGroupFor(t); setGroupDraft({ table: t, field: (outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f))[0] || null }); }}>
                  + Group by
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Group By Display */}
          {groupBy.filter(g => g.table === t).length > 0 && (
            <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>Grouped by:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {groupBy.filter(g => g.table === t).map(g => (
                  <Chip key={`${t}-group-${g.field}`} label={g.field} size="small" onDelete={() => onRemoveGroup(g)} color="info" />
                ))}
              </Box>
            </Box>
          )}

          {/* Summarize Section */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {(outputFields[t] && outputFields[t].length > 0) && (
              <Tooltip title="Add a calculation (SUM, COUNT, AVG, MIN, MAX).">
                <Button size="small" onClick={() => { setOpenAggFor(t); setAggDraft({ table: t, field: (outputFields[t] || [])[0] || '', func: 'COUNT' }); }}>
                  + Add summary
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* Active Summaries Display */}
          {aggregates.filter(a => a.table === t).length > 0 && (
            <Box sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>Summaries:</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {aggregates.filter(a => a.table === t).map(a => (
                  <Chip 
                    key={a.id} 
                    label={`${a.func}(${a.field})${a.alias ? ` as ${a.alias}` : ''}`} 
                    size="small" 
                    onDelete={() => onRemoveAggregate(a.id)} 
                    color="success"
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Filter summaries button */}
          {groupBy.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Tooltip title="Filter the summarized results after calculations.">
                <Button size="small" onClick={() => { setOpenHavingFor(t); setHavingDraft({ aggField: aggregates[0] ? (aggregates[0].alias || `${aggregates[0].func.toLowerCase()}_${aggregates[0].field}`) : '', op: '>=', value: '' }); }}>
                  + Filter summaries
                </Button>
              </Tooltip>
            </Box>
          )}

          {/* Having rules */}
          {having && having.filter(h => h.table === t).map(h => (
            <Chip key={h.id} label={`Only show summaries where ${h.aggField} ${h.op} ${h.value}`} size="small" onDelete={() => onRemoveHaving(h.id)} />
          ))}

          {openFilterFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Filter:</Typography>
                <select value={filterDraft.field || ''} onChange={(e) => setFilterDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {(outputFields[t] || []).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select value={filterDraft.op} onChange={(e) => setFilterDraft((d) => ({ ...d, op: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <TextField 
                  size="small" 
                  placeholder="value (required)" 
                  value={filterDraft.value} 
                  onChange={(e) => setFilterDraft((d) => ({ ...d, value: e.target.value }))}
                  error={filterDraft.value === ''}
                />
                <Button 
                  size="small" 
                  variant="contained" 
                  disabled={!filterDraft.field || filterDraft.value === '' || (filterDraft.exposedAsParam && filterDraft.param && !isValidSQLIdentifier(filterDraft.param))}
                  onClick={() => { onAddFilter(filterDraft); setOpenFilterFor(null); }}
                >
                  Add
                </Button>
                <Button size="small" onClick={() => setOpenFilterFor(null)}>Cancel</Button>
              </Box>
              <Box sx={{ width: '100%', display: 'flex', gap: 1, alignItems: 'center', mt: filterDraft.exposedAsParam ? 1 : 0 }}>
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
                    helperText={filterDraft.param && !isValidSQLIdentifier(filterDraft.param) ? 'Name must start with letter or underscore (no numbers, spaces, or special chars)' : ''}
                  />
                )}
              </Box>
            </Box>
          )}

          {openGroupFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Group by:</Typography>
              <select value={groupDraft.field || ''} onChange={(e) => setGroupDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                {(outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f)).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <Button size="small" variant="contained" disabled={!groupDraft.field} onClick={() => { onAddGroup({ table: t, field: groupDraft.field }); setOpenGroupFor(null); }}>Add</Button>
              <Button size="small" onClick={() => setOpenGroupFor(null)}>Cancel</Button>
            </Box>
          )}

          {openAggFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Calculation:</Typography>
                <select value={aggDraft.func} onChange={(e) => setAggDraft((d) => ({ ...d, func: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {aggs.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <Typography variant="caption">of</Typography>
                <select value={aggDraft.field || ''} onChange={(e) => setAggDraft((d) => ({ ...d, field: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                  {(outputFields[t] || []).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <TextField 
                  size="small" 
                  placeholder="name it (optional, e.g., total_count)" 
                  value={aggDraft.alias || ''} 
                  onChange={(e) => setAggDraft((d) => ({ ...d, alias: e.target.value }))}
                  error={aggDraft.alias && !isValidSQLIdentifier(aggDraft.alias)}
                  helperText={aggDraft.alias && !isValidSQLIdentifier(aggDraft.alias) ? 'Name must start with letter or underscore (no numbers, spaces, or special chars)' : 'Leave blank for auto-generated name (e.g., avg_age)'}
                />
                <Button 
                  size="small" 
                  variant="contained" 
                  disabled={!aggDraft.field || (aggDraft.alias && !isValidSQLIdentifier(aggDraft.alias))}
                  onClick={() => { 
                    onAddAggregate({ table: t, field: aggDraft.field, func: aggDraft.func, alias: aggDraft.alias }); 
                    setOpenAggFor(null); 
                  }}
                >
                  Add
                </Button>
                <Button size="small" onClick={() => setOpenAggFor(null)}>Cancel</Button>
              </Box>
            </Box>
          )}

          {openHavingFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {aggregates.length === 0 ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption">No summaries yet. </Typography>
                  <Button size="small" variant="contained" onClick={() => { onAddAggregate({ table: t, field: 'id', func: 'COUNT' }); setOpenHavingFor(null); }}>Add summary</Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)}>Cancel</Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Filter summaries:</Typography>
                  <select value={havingDraft.aggField || ''} onChange={(e) => setHavingDraft((d) => ({ ...d, aggField: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    {aggregates.map(a => {
                      const fieldNameOnly = a.field.split('.').pop();
                      const aliasLabel = a.alias || `${a.func.toLowerCase()}_${fieldNameOnly}`;
                      return (
                        <option key={a.id} value={aliasLabel}>{a.alias || `${a.func.toLowerCase()}(${a.field})`}</option>
                      );
                    })}
                  </select>
                  <select value={havingDraft.op || '>='} onChange={(e) => setHavingDraft((d) => ({ ...d, op: e.target.value }))} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value=">=">&geq;</option>
                    <option value=">">&gt;</option>
                    <option value="=">=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">&leq;</option>
                  </select>
                  <TextField 
                    size="small" 
                    placeholder="value (required)" 
                    value={havingDraft.value} 
                    onChange={(e) => setHavingDraft((d) => ({ ...d, value: e.target.value }))}
                    error={havingDraft.value === ''}
                  />
                  <Button 
                    size="small" 
                    variant="contained" 
                    disabled={!havingDraft.aggField || havingDraft.value === ''}
                    onClick={() => { onAddHaving({ table: t, aggField: havingDraft.aggField, op: havingDraft.op, value: havingDraft.value }); setOpenHavingFor(null); }}
                  >
                    Add
                  </Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)}>Cancel</Button>
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, alignItems: 'center' }}>
            <Tooltip title="Select all columns from this table."><Button size="small" onClick={() => onSelectAllFields(t)}>Select All</Button></Tooltip>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {((schema[t]?.columns) || []).slice(0, 40).map((c) => {
              const selected = (outputFields[t] || []).includes(c.name);
              return (
                <Tooltip key={c.name} title="Click to select/deselect this column.">
                  <Chip
                    label={c.name}
                    color={selected ? 'primary' : 'default'}
                    size="small"
                    onClick={() => onToggleField(t, c.name)}
                  />
                </Tooltip>
              );
            })}
            {((schema[t]?.columns) || []).length > 40 && <Typography variant="caption">...more fields</Typography>}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default Canvas;