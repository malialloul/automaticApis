import React, { useState, useContext } from 'react';
import { Box, Grid, Paper, Button, Typography, Divider, TextField, Snackbar, IconButton } from '@mui/material';
import SchemaSidebar from './SchemaSidebar';
import Canvas from './Canvas';
import PreviewPanel from './PreviewPanel';
import { AppContext } from '../../../App';
import { useConnection } from '../../../_shared/database/useConnection';
import { createEndpoint } from '../../../services/api';

const Builder = ({ onClose }) => {
  const { schema } = useContext(AppContext);
  const { currentConnection } = useConnection();
  const connectionId = currentConnection?.id;

  // Validation helper
  const isValidSQLIdentifier = (str) => {
    if (!str || str.length === 0) return true; // empty is ok
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str);
  };

  const hasValidationErrors = () => {
    // Check if any aggregation has invalid alias
    if (aggregates.some(a => a.alias && !isValidSQLIdentifier(a.alias))) {
      return true;
    }
    // Check if any filter has invalid param name
    if (filters.some(f => f.param && !isValidSQLIdentifier(f.param))) {
      return true;
    }
    return false;
  };

  const [tables, setTables] = useState([]); // list of table names added to canvas
  const [outputFields, setOutputFields] = useState({}); // { tableName: [fieldName] }
  const [joins, setJoins] = useState([]); // [{fromTable,toTable,fromColumn,toColumn,type}]
  const [filters, setFilters] = useState([]); // [{id, table, field, op, value}]
  const [groupBy, setGroupBy] = useState([]); // [{table, field}]
  const [aggregates, setAggregates] = useState([]); // [{id, table, field, func, alias}]

  const [having, setHaving] = useState([]); // [{id, aggField, op, value}]
  const addHaving = (h) => setHaving((s) => [...s, { id: uid(), ...h }]);
  const removeHaving = (id) => setHaving((s) => s.filter((x) => x.id !== id));

  const uid = () => Math.random().toString(36).slice(2, 9);

  const addFilter = (f) => setFilters((s) => [...s, { id: uid(), ...f }]);
  const removeFilter = (id) => setFilters((s) => s.filter((x) => x.id !== id));

  const addGroup = (g) => {
    setGroupBy((s) => [...s, g]);
    // Ensure the grouped field is selected
    setOutputFields((prev) => {
      const current = prev[g.table] || [];
      if (!current.includes(g.field)) {
        return { ...prev, [g.table]: [...current, g.field] };
      }
      return prev;
    });
  };
  const removeGroup = (g) => setGroupBy((s) => s.filter((x) => !(x.table === g.table && x.field === g.field)));

  const addAggregate = (a) => {
    setAggregates((s) => [...s, { id: uid(), ...a }]);
    // Ensure the aggregated field is selected
    setOutputFields((prev) => {
      const current = prev[a.table] || [];
      if (!current.includes(a.field)) {
        return { ...prev, [a.table]: [...current, a.field] };
      }
      return prev;
    });
  };
  const removeAggregate = (id) => setAggregates((s) => s.filter((x) => x.id !== id));

  const [openFilterFor, setOpenFilterFor] = useState(null);
  const [filterDraft, setFilterDraft] = useState({ table: null, field: null, op: 'eq', value: '' });
  const [openAggFor, setOpenAggFor] = useState(null);
  const [aggDraft, setAggDraft] = useState({ table: null, field: null, func: 'SUM' });
  const [openGroupFor, setOpenGroupFor] = useState(null);
  const [groupDraft, setGroupDraft] = useState({ table: null, field: null });
  const [openHavingFor, setOpenHavingFor] = useState(null);
  const [havingDraft, setHavingDraft] = useState({ aggField: '', op: '>=', value: '' });

  // detect simple join suggestions based on foreign keys present in schema
  const detectJoinSuggestions = () => {
    const suggestions = [];
    if (!schema) return suggestions;
    for (const t of tables) {
      const fks = schema[t]?.foreignKeys || [];
      for (const fk of fks) {
        const other = fk.foreignTable;
        if (tables.includes(other)) {
          suggestions.push({
            fromTable: t,
            toTable: other,
            fromColumn: fk.columnName,
            toColumn: fk.foreignColumn || fk.foreign_column || 'id',
            label: `${t}.${fk.columnName} → ${other}.${fk.foreignColumn || fk.foreign_column || 'id'}`,
          });
        }
      }
    }
    // also check reverse (other table has FK to this)
    for (const t of tables) {
      for (const other of tables) {
        if (t === other) continue;
        const fks = schema[other]?.foreignKeys || [];
        for (const fk of fks) {
          if (fk.foreignTable === t) {
            suggestions.push({
              fromTable: other,
              toTable: t,
              fromColumn: fk.columnName,
              toColumn: fk.foreignColumn || fk.foreign_column || 'id',
              label: `${other}.${fk.columnName} → ${t}.${fk.foreignColumn || fk.foreign_column || 'id'}`,
            });
          }
        }
      }
    }
    return suggestions;
  };

  const addJoin = (j) => {
    // avoid dup
    setJoins((cur) => {
      if (cur.some((x) => x.fromTable === j.fromTable && x.toTable === j.toTable && x.fromColumn === j.fromColumn && x.toColumn === j.toColumn)) return cur;
      return [...cur, j];
    });
  };
  const removeJoin = (j) => setJoins((cur) => cur.filter((x) => !(x.fromTable === j.fromTable && x.toTable === j.toTable && x.fromColumn === j.fromColumn && x.toColumn === j.toColumn)));
  const toggleJoinType = (j) => {
    const types = ['LEFT', 'INNER', 'RIGHT', 'FULL'];
    setJoins((cur) => cur.map((x) => {
      if (x.fromTable === j.fromTable && x.toTable === j.toTable && x.fromColumn === j.fromColumn && x.toColumn === j.toColumn) {
        const idx = types.indexOf(x.type || 'LEFT');
        const next = types[(idx + 1) % types.length];
        return { ...x, type: next };
      }
      return x;
    }));
  };

  const addTable = (tableName) => {
    if (!tables.includes(tableName)) setTables((t) => [...t, tableName]);
  };

  const removeTable = (tableName) => {
    setTables((t) => t.filter((x) => x !== tableName));
    setOutputFields((o) => {
      const n = { ...o };
      delete n[tableName];
      return n;
    });
  };

  const toggleField = (tableName, fieldName) => {
    const isAdding = !(outputFields[tableName] || []).includes(fieldName);
    if (isAdding) {
      // Prevent selecting fields that would cause SQL errors when there are groupings or aggregations
      const hasGroupBy = groupBy.length > 0;
      const hasAgg = aggregates.length > 0;
      if (hasGroupBy || hasAgg) {
        const inGroupBy = groupBy.some(g => g.table === tableName && g.field === fieldName);
        const inAgg = aggregates.some(a => a.table === tableName && a.field === fieldName);
        if (!inGroupBy && !inAgg) {
          setSnack({ msg: 'Cannot select this field when summaries or groupings are present. It would cause SQL errors. Add it to "Summarize by" or use in a calculation first.', severity: 'warning' });
          return;
        }
      }
    }
    setOutputFields((o) => {
      const cur = new Set(o[tableName] || []);
      if (cur.has(fieldName)) cur.delete(fieldName);
      else cur.add(fieldName);
      return { ...o, [tableName]: Array.from(cur) };
    });
  };

  const selectAllFields = (tableName) => {
    const allFields = (schema[tableName]?.columns || []).map(c => c.name);
    setOutputFields((o) => ({ ...o, [tableName]: allFields }));
  };

  const [saveOpen, setSaveOpen] = useState(false);
  const [endpointName, setEndpointName] = useState('');
  const [endpointSlug, setEndpointSlug] = useState('');
  const [snack, setSnack] = useState(null);

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  const openSave = () => {
    setEndpointName('');
    setEndpointSlug('');
    setSaveOpen(true);
  };

  const buildPayloadFromState = () => {
    const aliasMap = {};
    const used = new Set();
    const getAlias = (t) => {
      if (aliasMap[t]) return aliasMap[t];
      // simple alias: first letter unique, fallback to 't1' style
      const base = t[0] || 't';
      let a = base;
      let i = 1;
      while (used.has(a)) { a = `${base}${i}`; i++; }
      used.add(a);
      aliasMap[t] = a;
      return a;
    };

    const sourceTable = tables[0];
    const sourceAlias = getAlias(sourceTable);

    const formattedJoins = joins.map((j) => ({
      type: j.type || 'LEFT',
      from: { table: j.fromTable, field: j.fromColumn },
      to: { table: j.toTable, field: j.toColumn },
      alias: getAlias(j.toTable),
    }));

    // Ensure joined tables are included in output fields (default to all fields) so
    // preview shows both source and joined table columns unless the user explicitly
    // selected table-specific fields.
    const effectiveOutputFields = { ...outputFields };
    formattedJoins.forEach((j) => {
      const ft = j.from && j.from.table ? j.from.table : undefined;
      const tt = j.to && j.to.table ? j.to.table : undefined;
      if (ft && !(ft in effectiveOutputFields)) effectiveOutputFields[ft] = [];
      if (tt && !(tt in effectiveOutputFields)) effectiveOutputFields[tt] = [];
    });

    const formatField = (t, f) => `${getAlias(t)}.${f}`;

    const filtersFormatted = filters.map((f) => ({
      field: f.table && f.field ? `${getAlias(f.table)}.${f.field}` : f.field,
      op: f.op,
      value: f.value,
      exposedAsParam: !!f.exposedAsParam,
      param: f.param || undefined,
    }));

    const groupByFormatted = groupBy.map((g) => `${getAlias(g.table)}.${g.field}`);

    // Ensure all aggregations have proper aliases for HAVING clause to work
    const aggsFormatted = aggregates.map((a) => {
      // Always generate a consistent alias: either use provided one or generate from func_fieldname
      const fieldNameOnly = a.field.split('.').pop(); // strip table alias if present
      const generatedAlias = a.alias || `${a.func.toLowerCase()}_${fieldNameOnly}`;
      return { 
        type: a.func, 
        field: `${getAlias(a.table)}.${a.field}`, 
        as: generatedAlias 
      };
    });

    const fields = [];
    Object.entries(effectiveOutputFields).forEach(([t, fs]) => {
      if (!fs || fs.length === 0) {
        fields.push(`${getAlias(t)}.*`);
      } else {
        (fs || []).forEach((f) => fields.push(`${getAlias(t)}.${f}`));
      }
    });
    // include aggregate aliases
    aggsFormatted.forEach((a) => fields.push(a.as));

    const havingFormatted = having.map((h) => {
      // Find the aggregation that matches the alias to get the function and field
      const matchingAgg = aggregates.find(a => {
        const fieldNameOnly = a.field.split('.').pop();
        const alias = a.alias || `${a.func.toLowerCase()}_${fieldNameOnly}`;
        return alias === h.aggField;
      });
      
      return {
        aggField: h.aggField, // The alias name
        func: matchingAgg ? matchingAgg.func : 'COUNT', // The aggregation function (AVG, COUNT, etc.)
        field: matchingAgg ? matchingAgg.field : 'id', // The field being aggregated (e.g., "age")
        table: matchingAgg ? matchingAgg.table : undefined, // The table
        op: h.op,
        value: h.value,
      };
    });

    const payload = {
      name: endpointName,
      method: 'GET',
      path: `/${slugify(endpointName || 'endpoint')}`,
      source: { table: sourceTable, alias: sourceAlias },
      joins: formattedJoins,
      filters: filtersFormatted,
      groupBy: groupByFormatted,
      aggregations: aggsFormatted,
      having: havingFormatted,
      fields,
      paginate: true,
      pagination: { pageParam: 'page', sizeParam: 'page_size', defaultSize: 50, maxSize: 200 },
      sort: [],
      operations: ['read'],
    };

    return payload;
  };

  const doSave = async () => {
    if (!endpointName || endpointName.trim() === '') {
      setSnack({ msg: 'Please provide a name for the endpoint', severity: 'error' });
      return;
    }

    // Basic validation: require at least one field or an aggregate
    const hasFields = Object.values(outputFields || {}).some((arr) => Array.isArray(arr) && arr.length > 0);
    const hasAgg = aggregates && aggregates.length > 0;
    if (!hasFields && !hasAgg) {
      setSnack({ msg: 'Choose at least one field or add a calculation to include in the response.', severity: 'error' });
      return;
    }

    // If having rules exist, require aggregations
    if (having && having.length > 0 && !hasAgg) {
      setSnack({ msg: 'You added a summary filter but there are no summaries. Add a summary first.', severity: 'error' });
      return;
    }

    const payload = buildPayloadFromState();

    // Ensure the saved endpoint includes a canonical `graph` object so previews and Try-it
    // work consistently even if other parts of the code expect `endpoint.graph`.
    payload.graph = {
      source: payload.source,
      joins: payload.joins,
      fields: payload.fields,
      filters: payload.filters,
      groupBy: payload.groupBy,
      aggregations: payload.aggregations,
      having: payload.having,
    };
    
    // Include connectionId so we can filter endpoints by connection
    payload.connectionId = connectionId;

    try {
      const res = await createEndpoint(payload);
      setSaveOpen(false);
      // Close the panel and notify parent with success info
      if (onClose) {
        onClose({ success: true, slug: res.slug, message: `API saved! Endpoint: /api/${res.slug}` });
      }
      try { await navigator.clipboard.writeText(`/api/${res.slug}`); } catch (e) {}
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Save failed';
      setSnack({ msg, severity: 'error' });
    }
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', gap: 2, flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">API Builder</Typography>
        <Box>
          <Button size="small" onClick={openSave} sx={{ mr: 1 }} variant="contained">Save</Button>
          <Button size="small" onClick={onClose}>Close</Button>
        </Box>
      </Box>
      <Divider />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
        <Typography variant="body2" color="text.secondary">Add a table → choose fields → optionally add filters or summaries → Save.</Typography>
      </Box>
      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Grid item xs={2.5} sx={{ minHeight: 0 }}>
          <Paper sx={{ p: 1, height: '100%', overflow: 'auto' }}>
            <SchemaSidebar schema={schema} onAddTable={addTable} />
          </Paper>
        </Grid>
        <Grid item xs={4.5} sx={{ minHeight: 0 }}>
          <Paper sx={{ height: '100%', p: 1, overflow: 'auto' }}>
            <Canvas
              tables={tables}
              schema={schema}
              outputFields={outputFields}
              joins={joins}
              joinSuggestions={detectJoinSuggestions()}
              onAddJoin={addJoin}
              onRemoveJoin={removeJoin}
              onToggleJoinType={toggleJoinType}
              onToggleField={toggleField}
              onRemoveTable={removeTable}
              filters={filters}
              onAddFilter={addFilter}
              onRemoveFilter={removeFilter}
              groupBy={groupBy}
              onAddGroup={addGroup}
              onRemoveGroup={removeGroup}
              aggregates={aggregates}
              onAddAggregate={addAggregate}
              onRemoveAggregate={removeAggregate}
              having={having}
              onAddHaving={addHaving}
              onRemoveHaving={removeHaving}
              openFilterFor={openFilterFor}
              setOpenFilterFor={setOpenFilterFor}
              filterDraft={filterDraft}
              setFilterDraft={setFilterDraft}
              openAggFor={openAggFor}
              setOpenAggFor={setOpenAggFor}
              aggDraft={aggDraft}
              setAggDraft={setAggDraft}
              openGroupFor={openGroupFor}
              setOpenGroupFor={setOpenGroupFor}
              groupDraft={groupDraft}
              setGroupDraft={setGroupDraft}
              openHavingFor={openHavingFor}
              setOpenHavingFor={setOpenHavingFor}
              havingDraft={havingDraft}
              setHavingDraft={setHavingDraft}
              onSelectAllFields={selectAllFields}
            />
          </Paper>
        </Grid>
        <Grid item xs={5} sx={{ minHeight: 0 }}>
          <Paper sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PreviewPanel
              connectionId={connectionId}
              primaryTable={tables[0]}
              outputFields={outputFields}
              joins={joins}
              filters={filters}
              groupBy={groupBy}
              aggregates={aggregates}
              having={having}
              openFilterFor={openFilterFor}
              filterDraft={filterDraft}
              openAggFor={openAggFor}
              aggDraft={aggDraft}
              openGroupFor={openGroupFor}
              groupDraft={groupDraft}
              openHavingFor={openHavingFor}
              havingDraft={havingDraft}
              hasValidationErrors={hasValidationErrors()}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Save Modal (stub) */}
      {saveOpen && (
        <Paper sx={{ position: 'absolute', left: '50%', top: '20%', transform: 'translate(-50%, 0)', p: 2, width: 600 }}>
          <Typography variant="h6">Save Endpoint</Typography>
          <Divider sx={{ my: 1 }} />
          <TextField fullWidth size="small" label="Friendly name" value={endpointName} onChange={(e) => setEndpointName(e.target.value)} sx={{ mb: 1 }} />
          <TextField fullWidth size="small" label="Path (slug)" value={endpointSlug} onChange={(e) => setEndpointSlug(e.target.value)} sx={{ mb: 1 }} placeholder="auto generated" />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button size="small" variant="contained" onClick={doSave}>Save</Button>
          </Box>
        </Paper>
      )}

      {snack && (
        <Snackbar
          open
          autoHideDuration={5000}
          onClose={() => setSnack(null)}
          message={snack.msg}
          action={snack.action?.copy ? (
            <IconButton color="inherit" size="small" onClick={() => navigator.clipboard.writeText(snack.action.copy)}>
              Copy
            </IconButton>
          ) : undefined}
        />
      )}

    </Box>
  );
};

export default Builder;
