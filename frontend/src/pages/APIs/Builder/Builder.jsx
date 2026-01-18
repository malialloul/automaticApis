import React, { useState, useContext, useEffect } from 'react';
import { Box, Grid, Paper, Button, Typography, Divider, TextField, Snackbar, Alert, IconButton, alpha, useTheme, Dialog, DialogContent, DialogActions, Tooltip, Collapse, MenuItem, Chip } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PreviewIcon from '@mui/icons-material/Preview';
import SchemaSidebar from './SchemaSidebar';
import Canvas from './Canvas';
import PreviewPanel from './PreviewPanel';
import { AppContext } from '../../../App';
import { useConnection } from '../../../_shared/database/useConnection';
import { createEndpoint, updateEndpoint } from '../../../services/api';

const Builder = ({ onClose, editingEndpoint }) => {
  const { schema } = useContext(AppContext);
  const { currentConnection } = useConnection();
  const connectionId = currentConnection?.id;
  const theme = useTheme();

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
  const [previewExpanded, setPreviewExpanded] = useState(true); // Preview panel visibility

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
    const seen = new Set(); // Track unique suggestions to avoid duplicates
    if (!schema) return suggestions;
    
    // First, collect all explicitly defined FKs
    for (const t of tables) {
      const fks = schema[t]?.foreignKeys || [];
      for (const fk of fks) {
        const other = fk.foreignTable;
        if (tables.includes(other)) {
          const key = `${t}.${fk.columnName}->${other}.${fk.foreignColumn || fk.foreign_column || 'id'}`;
          if (!seen.has(key)) {
            seen.add(key);
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
    }
    
    // Check reverse relationships too (other table has FK to this)
    for (const t of tables) {
      for (const other of tables) {
        if (t === other) continue;
        const fks = schema[other]?.foreignKeys || [];
        for (const fk of fks) {
          if (fk.foreignTable === t) {
            const key = `${other}.${fk.columnName}->${t}.${fk.foreignColumn || fk.foreign_column || 'id'}`;
            if (!seen.has(key)) {
              seen.add(key);
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
    
    // Prevent deselecting required fields when method is POST
    if (!isAdding && endpointMethod === 'POST' && isRequiredField(tableName, fieldName)) {
      setSnack({ msg: `Cannot deselect "${fieldName}" - it's a required field for ${endpointMethod}. Change method to deselect.`, severity: 'warning' });
      return;
    }
    
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
  const [endpointMethod, setEndpointMethod] = useState('GET');
  const [snack, setSnack] = useState(null);

  // Helper to check if a field is required (NOT NULL, no default, not a PK)
  const isRequiredField = (tableName, fieldName) => {
    if (!schema || !schema[tableName]) return false;
    const cols = schema[tableName].columns || [];
    const pks = schema[tableName].primaryKeys || [];
    const col = cols.find(c => c.name === fieldName);
    if (!col) return false;
    // Skip PKs - they're usually auto-generated
    if (pks.includes(col.name)) return false;
    
    const isNullable = col.nullable === true || col.nullable === 'YES';
    const hasDefault = col.default !== null && col.default !== undefined && col.default !== '';
    
    // Field is required if: not nullable AND no default
    // FK columns are only required if they are non-nullable without default
    return !isNullable && !hasDefault;
  };

  // Get all required fields for all tables
  const getRequiredFields = () => {
    const required = {};
    tables.forEach(table => {
      const cols = schema?.[table]?.columns || [];
      const pks = schema?.[table]?.primaryKeys || [];
      required[table] = cols
        .filter(col => {
          if (pks.includes(col.name)) return false;
          
          const isNullable = col.nullable === true || col.nullable === 'YES';
          const hasDefault = col.default !== null && col.default !== undefined && col.default !== '';
          
          // Field is required if: not nullable AND no default
          return !isNullable && !hasDefault;
        })
        .map(c => c.name);
    });
    return required;
  };

  // Auto-select required fields when method changes to POST
  useEffect(() => {
    if (endpointMethod === 'POST' && schema && tables.length > 0) {
      const requiredFields = getRequiredFields();
      setOutputFields(prev => {
        const updated = { ...prev };
        Object.entries(requiredFields).forEach(([table, fields]) => {
          const current = new Set(prev[table] || []);
          fields.forEach(f => current.add(f));
          updated[table] = Array.from(current);
        });
        return updated;
      });
    }
  }, [endpointMethod, tables, schema]);

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  // Load editing endpoint data on mount
  useEffect(() => {
    if (!editingEndpoint) return;
    
    const graph = editingEndpoint.graph || editingEndpoint;
    
    // Load tables
    const loadedTables = [];
    if (graph.source?.table) {
      loadedTables.push(graph.source.table);
    }
    
    // Extract tables from joins
    (graph.joins || []).forEach(j => {
      const fromTable = j.from?.table || j.fromTable || j.from;
      const toTable = j.to?.table || j.toTable || j.to;
      if (fromTable && !loadedTables.includes(fromTable)) loadedTables.push(fromTable);
      if (toTable && !loadedTables.includes(toTable)) loadedTables.push(toTable);
    });
    
    setTables(loadedTables);
    
    // Load output fields
    if (graph.outputFields) {
      setOutputFields(graph.outputFields);
    }
    
    // Load joins
    const loadedJoins = (graph.joins || []).map(j => ({
      fromTable: j.from?.table || j.fromTable || j.from,
      toTable: j.to?.table || j.toTable || j.to,
      fromColumn: j.from?.field || j.fromColumn || j.from_col,
      toColumn: j.to?.field || j.toColumn || j.to_col,
      type: j.type || 'LEFT',
    }));
    setJoins(loadedJoins);
    
    // Load filters - prefer _editState if available (has original table names)
    const editState = graph._editState;
    const loadedFilters = (editState?.filters || graph.filters || []).map(f => ({
      id: uid(),
      table: f.table || (f.field?.includes('.') ? f.field.split('.')[0] : graph.source?.table),
      field: f.field?.includes('.') ? f.field.split('.')[1] : f.field,
      op: f.op || 'eq',
      value: f.value || '',
    }));
    setFilters(loadedFilters);
    
    // Load groupBy - prefer _editState if available
    const loadedGroupBy = (editState?.groupBy || graph.groupBy || []).map(g => {
      if (typeof g === 'string' && g.includes('.')) {
        const [table, field] = g.split('.');
        return { id: uid(), table, field };
      }
      return { id: uid(), ...g };
    });
    setGroupBy(loadedGroupBy);
    
    // Load aggregations - prefer _editState if available
    const loadedAggregates = (editState?.aggregates || graph.aggregations || []).map(a => ({
      id: uid(),
      table: a.table || (a.field?.includes('.') ? a.field.split('.')[0] : graph.source?.table),
      field: a.field?.includes('.') ? a.field.split('.')[1] : a.field,
      func: a.type || a.func || 'COUNT',
      alias: a.as || a.alias || '',
    }));
    setAggregates(loadedAggregates);
    
    // Load having - prefer _editState if available
    const loadedHaving = (editState?.having || graph.having || []).map(h => ({
      id: uid(),
      aggField: h.aggField || '',
      op: h.op || '>=',
      value: h.value || '',
    }));
    setHaving(loadedHaving);
    
    // Set name, slug, and method for save dialog
    setEndpointName(editingEndpoint.name || '');
    setEndpointSlug(editingEndpoint.slug || '');
    setEndpointMethod(editingEndpoint.method || 'GET');
  }, [editingEndpoint]);

  const openSave = () => {
    if (editingEndpoint) {
      // When editing, pre-fill with existing values
      setEndpointName(editingEndpoint.name || '');
      setEndpointSlug(editingEndpoint.slug || '');
      // Don't reset method - it's already set in header or from editingEndpoint
    } else {
      setEndpointName('');
      setEndpointSlug('');
      // Don't reset method - user already selected it in the header
    }
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

    // Map method to operations
    const methodOperations = {
      GET: ['read'],
      POST: ['create'],
      PUT: ['update'],
      DELETE: ['delete'],
    };

    const payload = {
      name: endpointName,
      method: endpointMethod,
      path: `/${slugify(endpointName || 'endpoint')}`,
      source: { table: sourceTable, alias: sourceAlias },
      joins: formattedJoins,
      filters: filtersFormatted,
      groupBy: groupByFormatted,
      aggregations: aggsFormatted,
      having: havingFormatted,
      fields,
      paginate: endpointMethod === 'GET',
      pagination: endpointMethod === 'GET' ? { pageParam: 'page', sizeParam: 'page_size', defaultSize: 50, maxSize: 200 } : undefined,
      sort: [],
      operations: methodOperations[endpointMethod] || ['read'],
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

    // For POST method, check if required fields (NOT NULL without default) are selected
    if (endpointMethod === 'POST' && schema && tables.length > 0) {
      const missingRequired = [];
      tables.forEach(table => {
        const cols = schema[table]?.columns || [];
        const pks = schema[table]?.primaryKeys || [];
        const selectedFields = outputFields[table] || [];
        
        cols.forEach(col => {
          // Skip auto-increment PKs (they're generated)
          if (pks.includes(col.name) && col.isAutoIncrement) return;
          // Skip PKs entirely for POST (they're usually auto-generated)
          if (pks.includes(col.name)) return;
          // Check if column is required (NOT NULL and no default)
          // nullable: true means can be NULL, nullable: false means required
          const isNullable = col.nullable === true || col.nullable === 'YES';
          const hasDefault = col.default !== null && col.default !== undefined && col.default !== '';
          const isRequired = !isNullable && !hasDefault;
          if (isRequired && !selectedFields.includes(col.name)) {
            missingRequired.push(`${table}.${col.name}`);
          }
        });
      });
      
      if (missingRequired.length > 0) {
        setSnack({ 
          msg: `Warning: Required fields not selected for POST: ${missingRequired.slice(0, 3).join(', ')}${missingRequired.length > 3 ? ` and ${missingRequired.length - 3} more` : ''}. These fields won't be in the request body.`, 
          severity: 'warning' 
        });
        // Don't block save, just warn
      }
    }

    const payload = buildPayloadFromState();

    // Ensure the saved endpoint includes a canonical `graph` object so previews and Try-it
    // work consistently even if other parts of the code expect `endpoint.graph`.
    // Store BOTH the formatted version (for execution) AND the original state (for editing)
    payload.graph = {
      source: payload.source,
      joins: payload.joins,
      // Explicit list of all tables involved (source + joined tables) for POST/PUT body fields
      tables: tables,
      filters: payload.filters,
      groupBy: payload.groupBy,
      aggregations: payload.aggregations,
      having: payload.having,
      fields: payload.fields,
      outputFields: outputFields,
      // Store original unformatted data for editing (with table names, not aliases)
      _editState: {
        filters: filters.map(f => ({ ...f })),
        groupBy: groupBy.map(g => ({ ...g })),
        aggregates: aggregates.map(a => ({ ...a })),
        having: having.map(h => ({ ...h })),
      },
    };
    
    // Include connectionId so we can filter endpoints by connection
    payload.connectionId = connectionId;

    try {
      let res;
      if (editingEndpoint) {
        // Update existing endpoint
        res = await updateEndpoint(editingEndpoint.slug, payload);
        setSaveOpen(false);
        if (onClose) {
          onClose({ success: true, slug: res.slug, message: `API updated! Endpoint: /api/${res.slug}`, updated: true });
        }
      } else {
        // Create new endpoint
        res = await createEndpoint(payload);
        setSaveOpen(false);
        if (onClose) {
          onClose({ success: true, slug: res.slug, message: `API saved! Endpoint: /api/${res.slug}` });
        }
      }
      try { await navigator.clipboard.writeText(`/api/${res.slug}`); } catch (e) {}
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Save failed';
      setSnack({ msg, severity: 'error' });
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Scrollable Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3.5, pb: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BuildIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {editingEndpoint ? 'Edit API Endpoint' : 'API Builder'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {editingEndpoint 
                  ? `Editing: ${editingEndpoint.name || editingEndpoint.slug}`
                  : 'Create custom endpoints with visual query builder'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {/* HTTP Method Selector - visible before saving */}
            <TextField
              select
              size="small"
              value={endpointMethod}
              onChange={(e) => setEndpointMethod(e.target.value)}
              sx={{ 
                minWidth: 130,
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
            >
              {[
                { value: 'GET', label: 'GET', color: 'success' },
                { value: 'POST', label: 'POST', color: 'info' },
                { value: 'PUT', label: 'PUT', color: 'warning' },
                { value: 'DELETE', label: 'DELETE', color: 'error' },
              ].map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  <Chip 
                    label={m.label} 
                    size="small" 
                    color={m.color}
                    sx={{ fontWeight: 600, minWidth: 65 }}
                  />
                </MenuItem>
              ))}
            </TextField>
            <Tooltip 
              title={
                tables.length === 0 
                  ? "Add a table first" 
                  : !Object.values(outputFields).some(f => f && f.length > 0)
                    ? "Select at least one field"
                    : ""
              }
            >
              <span>
                <Button 
                  onClick={openSave} 
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={tables.length === 0 || !Object.values(outputFields).some(f => f && f.length > 0)}
                  sx={{ borderRadius: 2, textTransform: 'none', px: 2.5 }}
                >
                  {editingEndpoint ? 'Update Endpoint' : 'Save Endpoint'}
                </Button>
              </span>
            </Tooltip>
            <Button 
              onClick={onClose}
              variant="outlined"
              startIcon={<CloseIcon />}
              sx={{ borderRadius: 2, textTransform: 'none', px: 2.5 }}
            >
              Close
            </Button>
          </Box>
        </Box>

        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2.5, 
            borderRadius: 2, 
            bgcolor: alpha(theme.palette.info.main, 0.05),
            borderColor: alpha(theme.palette.info.main, 0.2),
            mb: 2.5,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            <strong>Quick guide:</strong> Add a table → choose fields → optionally add filters or summaries → Save.
          </Typography>
        </Paper>

        <Grid container spacing={2.5}>
          <Grid item xs={12} md={3} sx={{ minWidth: 220 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }} data-tour="builder-schema">
              <SchemaSidebar schema={schema} onAddTable={addTable} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={9}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }} data-tour="builder-canvas">
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
              endpointMethod={endpointMethod}
              requiredFields={endpointMethod === 'POST' ? getRequiredFields() : {}}
            />
          </Paper>
        </Grid>
      </Grid>
      </Box>

      {/* Fixed Preview Panel at Bottom */}
      <Paper 
        variant="outlined" 
        sx={{ 
          borderRadius: 0,
          borderLeft: 0,
          borderRight: 0,
          borderBottom: 0,
          overflow: 'hidden',
          flexShrink: 0,
        }}
        data-tour="builder-preview"
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            p: 1.5,
            px: 2,
            bgcolor: alpha(theme.palette.success.main, 0.05),
            borderBottom: previewExpanded ? 1 : 0,
            borderColor: 'divider',
            cursor: 'pointer',
          }}
          onClick={() => setPreviewExpanded(!previewExpanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PreviewIcon sx={{ color: 'success.main', fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle2" fontWeight={600}>Live Preview</Typography>
            {tables[0] && (
              <Typography variant="caption" color="text.secondary">
                — {tables[0]}
              </Typography>
            )}
          </Box>
          <IconButton size="small">
            {previewExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={previewExpanded}>
          <Box sx={{ px: 2.5, py: 2, height: 250, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
              compact
            />
          </Box>
        </Collapse>
      </Paper>

      {/* Save Modal */}
      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2.5,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SaveIcon sx={{ color: 'white', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {editingEndpoint ? 'Update Endpoint' : 'Save Endpoint'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingEndpoint ? 'Update your API endpoint' : 'Create a reusable API endpoint'}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setSaveOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 2.5 }}>
          <TextField 
            fullWidth 
            size="small" 
            label="Friendly name" 
            value={endpointName} 
            onChange={(e) => setEndpointName(e.target.value)} 
            sx={{ 
              mb: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }} 
          />
          <TextField 
            fullWidth 
            size="small" 
            label="Path (slug)" 
            value={endpointSlug} 
            onChange={(e) => setEndpointSlug(e.target.value)} 
            placeholder="Auto generated if empty"
            disabled={!!editingEndpoint} // Disable slug editing when updating
            helperText={editingEndpoint ? "Slug cannot be changed" : undefined}
            sx={{ 
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }} 
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => setSaveOpen(false)}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={doSave}
            startIcon={<SaveIcon />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {editingEndpoint ? 'Update Endpoint' : 'Save Endpoint'}
          </Button>
        </DialogActions>
      </Dialog>

      {snack && (
        <Snackbar
          open
          autoHideDuration={snack.severity === 'warning' ? 8000 : 5000}
          onClose={() => setSnack(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnack(null)} 
            severity={snack.severity || 'info'} 
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {snack.msg}
          </Alert>
        </Snackbar>
      )}

    </Box>
  );
};

export default Builder;
