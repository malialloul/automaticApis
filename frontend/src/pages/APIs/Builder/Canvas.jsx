import React from 'react';
import { Box, Typography, Paper, IconButton, Chip, Button, TextField, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1, alignItems: 'center' }}>
            {(outputFields[t] && outputFields[t].length > 0) && <Tooltip title="Filter the data before summarizing or calculating."><Button size="small" onClick={() => { setOpenFilterFor(t); setFilterDraft({ table: t, field: (outputFields[t] || [])[0] || null, op: 'eq', value: '' }); }}>Add filter</Button></Tooltip>}
            {(outputFields[t] && outputFields[t].length > 0) && <Tooltip title="Group data by this field to see summary information instead of individual rows."><Button size="small" onClick={() => { setOpenGroupFor(t); setGroupDraft({ table: t, field: (outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f))[0] || null }); }}>Summarize by</Button></Tooltip>}
          </Box>

          {filters.filter(f => f.table === t).map(f => (
            <Chip key={f.id} label={`${f.table}.${f.field} ${f.op} ${f.value}`} size="small" onDelete={() => onRemoveFilter(f.id)} />
          ))}

          {groupBy.filter(g => g.table === t).map(g => (
            <Chip key={`${t}-group-${g.field}`} label={`Summarize by ${g.field}`} size="small" onDelete={() => onRemoveGroup(g)} />
          ))}
          {groupBy.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Tooltip title="Filter the summarized results after calculations."><Button size="small" onClick={() => { setOpenHavingFor(t); setHavingDraft({ aggField: aggregates[0] ? (aggregates[0].alias || `${aggregates[0].func.toLowerCase()}_${aggregates[0].field}`) : '', op: '>=', value: '' }); }}>Filter summaries</Button></Tooltip>
            </Box>
          )}
          {aggregates.filter(a => a.table === t).map(a => (
            <Chip key={a.id} label={`${a.func}(${a.table}.${a.field}) AS ${a.alias || a.func.toLowerCase()}`} size="small" onDelete={() => onRemoveAggregate(a.id)} />
          ))}

          {/* Having rules */}
          {having && having.filter(h => h.table === t).map(h => (
            <Chip key={h.id} label={`Only show summaries where ${h.aggField} ${h.op} ${h.value}`} size="small" onDelete={() => onRemoveHaving(h.id)} />
          ))}

          {openFilterFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              <select value={filterDraft.field || ''} onChange={(e) => setFilterDraft((d) => ({ ...d, field: e.target.value }))}>
                {(outputFields[t] || []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select value={filterDraft.op} onChange={(e) => setFilterDraft((d) => ({ ...d, op: e.target.value }))}>
                {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input value={filterDraft.value} onChange={(e) => setFilterDraft((d) => ({ ...d, value: e.target.value }))} placeholder="value" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={filterDraft.exposedAsParam || false} onChange={(e) => setFilterDraft((d) => ({ ...d, exposedAsParam: e.target.checked }))} />
                Expose as parameter
              </label>
              {filterDraft.exposedAsParam && (
                <input value={filterDraft.param || ''} onChange={(e) => setFilterDraft((d) => ({ ...d, param: e.target.value }))} placeholder="param name" />
              )}
              <Button size="small" onClick={() => { onAddFilter(filterDraft); setOpenFilterFor(null); }}>Save</Button>
              <Button size="small" onClick={() => setOpenFilterFor(null)}>Cancel</Button>
            </Box>
          )}

          {openGroupFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <select value={groupDraft.field || ''} onChange={(e) => setGroupDraft((d) => ({ ...d, field: e.target.value }))}>
                {(outputFields[t] || []).filter(f => !groupBy.some(g => g.table === t && g.field === f)).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <Button size="small" onClick={() => { onAddGroup({ table: t, field: groupDraft.field }); setOpenGroupFor(null); }}>Add</Button>
              <Button size="small" onClick={() => setOpenGroupFor(null)}>Cancel</Button>
            </Box>
          )}

          {openAggFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <select value={aggDraft.field || ''} onChange={(e) => setAggDraft((d) => ({ ...d, field: e.target.value }))}>
                {(outputFields[t] || []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select value={aggDraft.func} onChange={(e) => setAggDraft((d) => ({ ...d, func: e.target.value }))}>
                {aggs.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <TextField size="small" placeholder="alias (optional)" value={aggDraft.alias || ''} onChange={(e) => setAggDraft((d) => ({ ...d, alias: e.target.value }))} />
              <Button size="small" onClick={() => { onAddAggregate({ table: t, field: aggDraft.field, func: aggDraft.func, alias: aggDraft.alias }); setOpenAggFor(null); }}>Add</Button>
              <Button size="small" onClick={() => setOpenAggFor(null)}>Cancel</Button>
            </Box>
          )}

          {openHavingFor === t && (
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              {aggregates.length === 0 ? (
                <>
                  <Button size="small" onClick={() => { onAddAggregate({ table: t, field: (outputFields[t] || [])[0] || 'id', func: 'COUNT' }); }}>Add summary</Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button size="small" onClick={() => { onAddAggregate({ table: t, field: (outputFields[t] || [])[0] || 'id', func: 'COUNT' }); }}>Add summary</Button>
                  <select value={havingDraft.aggField || ''} onChange={(e) => setHavingDraft((d) => ({ ...d, aggField: e.target.value }))}>
                    {aggregates.map(a => (
                      <option key={a.id} value={a.alias || `${a.func.toLowerCase()}_${a.field}`}>{a.alias || `${a.func.toLowerCase()}(${a.field})`}</option>
                    ))}
                  </select>
                  <select value={havingDraft.op || '>='} onChange={(e) => setHavingDraft((d) => ({ ...d, op: e.target.value }))}>
                    <option value=">=">≥</option>
                    <option value={">"}>&gt;</option>
                    <option value="=">=</option>
                    <option value="<">&lt;</option>
                    <option value="<=">≤</option>
                  </select>
                  <input value={havingDraft.value} onChange={(e) => setHavingDraft((d) => ({ ...d, value: e.target.value }))} placeholder="value" />
                  <Button size="small" onClick={() => { onAddHaving({ table: t, aggField: havingDraft.aggField, op: havingDraft.op, value: havingDraft.value }); setOpenHavingFor(null); }}>Add</Button>
                  <Button size="small" onClick={() => setOpenHavingFor(null)}>Cancel</Button>
                </>
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