import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
} from "react";
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Grid,
  Alert,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
  Collapse,
  Chip,
  Autocomplete,
  Tooltip,
  alpha,
  useTheme,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ReactJson from "@microlink/react-json-view";
import { getSchema, listRecords, getOperators } from "../../../services/api";
import api from "../../../services/api";
import GetOptionsPanel from "./components/GetOptionsPanel";
import {
  renderColumnControl,
  formatRowSummary,
} from "../../../_shared/database/utils";
import { AppContext } from "../../../App";
import AdditionalFiltersToggle from "./components/AdditionalFiltersToggle";
import TextInputField from "./components/TextInputField";

const APITester = ({
  connectionId,
  endpoint,
  selectedTable,
  operation,
  operatorsMap,
}) => {
  const { schema } = useContext(AppContext);
  const theme = useTheme();

  const [bodyFields, setBodyFields] = useState({});
  const [nextAutoId, setNextAutoId] = useState(null);
  const [foreignKeyOptions, setForeignKeyOptions] = useState({});
  const [pageSize, setPageSize] = useState("");
  const [pageNumber, setPageNumber] = useState("1");
  const [orderBy, setOrderBy] = useState("");
  const [orderDir, setOrderDir] = useState("ASC");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({});

  // Additional filters are collapsed by default
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Auto-expand filters when performing a DELETE (safer UX)
  useEffect(() => {
    if (operation === "DELETE") setFiltersCollapsed(false);
  }, [operation]);
  
  // Default operators to use when none are available from backend
  const defaultOperators = [
    { value: 'eq', label: '=' },
    { value: 'neq', label: '!=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'like', label: 'contains' },
    { value: 'in', label: 'in' },
  ];
  
  // Return operator options appropriate for the column type
  function getOperatorsForColumn(col, tableName = null) {
    // Prefer backend-provided operators when available
    const table = tableName || selectedTable;
    const colName = col.originalName || col.name;
    try {
      const ops = operatorsMap?.[table]?.[colName] ??
        operatorsMap?.[selectedTable]?.[colName] ??
        operatorsMap?.[endpoint?.relatedTable]?.[colName];
      
      // Return backend operators if available, otherwise use defaults
      return (ops && ops.length > 0) ? ops : defaultOperators;
    } catch (e) {
      return defaultOperators;
    }
  }
  // Initialize filter inputs when selectedTable or schema changes
  useEffect(() => {
    if (!schema || !selectedTable) return;
    
    // Collect all tables from endpoint graph if available
    const tablesToInclude = [];
    if (endpoint?.graph?.source?.table) {
      tablesToInclude.push(endpoint.graph.source.table);
      (endpoint.graph.joins || []).forEach(j => {
        const toTable = j.to?.table || j.toTable || j.to;
        const fromTable = j.from?.table || j.fromTable || j.from;
        if (toTable && !tablesToInclude.includes(toTable)) tablesToInclude.push(toTable);
        if (fromTable && !tablesToInclude.includes(fromTable)) tablesToInclude.push(fromTable);
      });
    } else {
      tablesToInclude.push(selectedTable);
      if (endpoint?.relatedTable) tablesToInclude.push(endpoint.relatedTable);
    }
    
    const hasMultipleTables = tablesToInclude.length > 1;
    const obj = {};
    tablesToInclude.forEach(tableName => {
      const cols = schema[tableName]?.columns || [];
      cols.forEach((c) => {
        if ((c.name || "").toLowerCase().includes("password")) return;
        const key = hasMultipleTables ? `${tableName}.${c.name}` : c.name;
        const ops = getOperatorsForColumn(c, tableName);
        obj[key] = { op: ops[0]?.value || 'eq', val: "" };
      });
    });

    setFilters(obj);
    setOrderBy("");
    setOrderDir("ASC");
    setPageSize("");
    setPageNumber("1");
  }, [schema, selectedTable]);

  // Initialize bodyFields for POST/PUT based on column types (exclude PK and sensitive fields)
  useEffect(() => {
    if (!schema) return;
    const endpointMethod = endpoint?.method || operation;
    if (endpointMethod !== "POST" && endpointMethod !== "PUT") return;
    
    const sourceTable = endpoint?.graph?.source?.table || selectedTable;
    
    // Collect tables to include: for POST include all (source + joined), for PUT only source
    const tablesToInclude = [];
    if (endpoint?.graph?.source?.table) {
      tablesToInclude.push(endpoint.graph.source.table);
      // For POST: include joined tables. For PUT: only source table (can't update joined tables)
      if (endpointMethod === "POST") {
        (endpoint.graph.joins || []).forEach(j => {
          const toTable = j.to?.table || j.toTable || j.to;
          const fromTable = j.from?.table || j.fromTable || j.from;
          if (toTable && !tablesToInclude.includes(toTable)) tablesToInclude.push(toTable);
          if (fromTable && !tablesToInclude.includes(fromTable)) tablesToInclude.push(fromTable);
        });
      }
    } else if (selectedTable) {
      tablesToInclude.push(selectedTable);
    }
    
    // Get outputFields from endpoint if available (user-selected fields in Builder)
    const endpointOutputFields = endpoint?.graph?.outputFields || endpoint?.outputFields;
    
    const body = {};
    tablesToInclude.forEach(table => {
      const cols = schema[table]?.columns || [];
      const pks = schema[table]?.primaryKeys || [];
      const prefix = tablesToInclude.length > 1 ? `${table}.` : '';
      
      // If endpoint has outputFields, only include those fields
      const selectedFieldsForTable = endpointOutputFields?.[table];
      
      cols.forEach((c) => {
        // If outputFields exist for this table, only include selected fields
        if (selectedFieldsForTable && !selectedFieldsForTable.includes(c.name)) return;
        
        if (pks.includes(c.name)) return; // Skip PK
        const name = (c.name || "").toLowerCase();
        // Skip password fields only for PUT (updates), not for POST (new records)
        if (name.includes("password") && endpointMethod === "PUT") return;
        const type = (c.type || "").toLowerCase();
        let def = c.default;
        if (typeof def === "string" && def.includes("::")) {
          def = def.split("::")[0];
          if (def.startsWith("'") && def.endsWith("'")) {
            def = def.slice(1, -1);
          }
        }
        const key = prefix + c.name;
        if (Array.isArray(c.enumOptions) && c.enumOptions.length > 0) {
          body[key] = c.enumOptions[0] ?? "";
        } else if (
          [
            "int",
            "integer",
            "bigint",
            "smallint",
            "numeric",
            "decimal",
            "float",
            "double",
            "real",
          ].some((t) => type.includes(t))
        ) {
          body[key] = "";
        } else if (["bool", "boolean"].some((t) => type.includes(t))) {
          body[key] = "";
        } else if (
          ["date", "timestamp", "datetime"].some((t) => type.includes(t))
        ) {
          body[key] = "";
        } else {
          body[key] = def ?? "";
        }
      });
    });
    setBodyFields(body);
  }, [schema, selectedTable, operation, endpoint]);

  const buildPayloadFromBodyFields = () => {
    if (!schema || !selectedTable) return {};
    const cols = schema[selectedTable]?.columns || [];
    const pks = schema[selectedTable]?.primaryKeys || [];
    const fks = schema[selectedTable]?.foreignKeys || [];
    const fkCols = (fks || []).map((f) => f.columnName);
    const payload = {};
    Object.entries(bodyFields || {}).forEach(([k, v]) => {
      if (v === "" || v === undefined) return; // skip empty
      const col = cols.find((c) => c.name === k);

      // Skip primary keys unless they are also foreign keys
      const isPk = pks.includes(k);
      const isFk = fkCols.includes(k);
      if (isPk && !isFk) return;

      const type = (col?.type || "").toLowerCase();
      // booleans
      if (["bool", "boolean"].some((t) => type.includes(t))) {
        if (v === true || v === "true" || v === "1") payload[k] = true;
        else if (v === false || v === "false" || v === "0") payload[k] = false;
        else payload[k] = Boolean(v);
        return;
      }
      // numbers
      if (
        [
          "int",
          "integer",
          "bigint",
          "smallint",
          "numeric",
          "decimal",
          "float",
          "double",
          "real",
        ].some((t) => type.includes(t))
      ) {
        const num = Number(v);
        if (!Number.isNaN(num)) payload[k] = num;
        return;
      }
      // default: send as-is (strings, enums, dates)
      payload[k] = v;
    });
    return payload;
  };

  const buildPostPayload = () => {
    if (!schema) return {};
    
    // Collect all tables to include: source + joined tables
    const tablesToInclude = [];
    if (endpoint?.graph?.source?.table) {
      tablesToInclude.push(endpoint.graph.source.table);
      (endpoint.graph.joins || []).forEach(j => {
        const toTable = j.to?.table || j.toTable || j.to;
        const fromTable = j.from?.table || j.fromTable || j.from;
        if (toTable && !tablesToInclude.includes(toTable)) tablesToInclude.push(toTable);
        if (fromTable && !tablesToInclude.includes(fromTable)) tablesToInclude.push(fromTable);
      });
    } else if (selectedTable) {
      tablesToInclude.push(selectedTable);
    }
    
    const payload = {};
    Object.entries(bodyFields || {}).forEach(([k, v]) => {
      if (v === "" || v === undefined) return;
      
      // Parse table.column format or use source table
      let table, colName;
      if (k.includes('.')) {
        [table, colName] = k.split('.');
      } else {
        table = tablesToInclude[0] || selectedTable;
        colName = k;
      }
      
      const cols = schema[table]?.columns || [];
      const col = cols.find((c) => c.name === colName);
      if (!col) return;
      
      const pks = schema[table]?.primaryKeys || [];
      // Exclude PK if auto-increment (password fields are allowed for POST)
      if (pks.includes(colName) && col.isAutoIncrement) return;
      
      const type = (col?.type || "").toLowerCase();
      let processedValue = v;
      
      // booleans
      if (["bool", "boolean"].some((t) => type.includes(t))) {
        if (v === true || v === "true" || v === "1") processedValue = true;
        else if (v === false || v === "false" || v === "0") processedValue = false;
        else processedValue = Boolean(v);
      }
      // numbers
      else if (
        [
          "int",
          "integer",
          "bigint",
          "smallint",
          "numeric",
          "decimal",
          "float",
          "double",
          "real",
        ].some((t) => type.includes(t))
      ) {
        const num = Number(v);
        if (!Number.isNaN(num)) processedValue = num;
        else return; // Skip if not a valid number
      }
      
      // Keep the full key (table.column) for multi-table inserts
      payload[k] = processedValue;
    });
    return payload;
  };

  // Load foreign key options for dropdowns when selectedTable or endpoint changes
  useEffect(() => {
    if (!schema || !connectionId) return;
    
    // Collect all tables to load FK options for
    const tablesToLoad = [];
    if (endpoint?.graph?.source?.table) {
      tablesToLoad.push(endpoint.graph.source.table);
      (endpoint.graph.joins || []).forEach(j => {
        const toTable = j.to?.table || j.toTable || j.to;
        const fromTable = j.from?.table || j.fromTable || j.from;
        if (toTable && !tablesToLoad.includes(toTable)) tablesToLoad.push(toTable);
        if (fromTable && !tablesToLoad.includes(fromTable)) tablesToLoad.push(fromTable);
      });
    } else if (selectedTable) {
      tablesToLoad.push(selectedTable);
    }
    
    if (tablesToLoad.length === 0) return;
    
    // Collect all FKs from all tables
    const allFks = [];
    tablesToLoad.forEach(table => {
      const fks = schema[table]?.foreignKeys || [];
      const prefix = tablesToLoad.length > 1 ? `${table}.` : '';
      fks.forEach(fk => {
        allFks.push({ ...fk, prefixedColumn: prefix + fk.columnName });
      });
    });
    
    const options = {};
    const fetches = allFks.map(async (fk) => {
      try {
        const rows = await listRecords(connectionId, fk.foreignTable, {
          limit: 1000,
        });
        options[fk.prefixedColumn] = rows;
        // Also store without prefix for backward compatibility
        if (!options[fk.columnName]) options[fk.columnName] = rows;
      } catch (e) {
        options[fk.prefixedColumn] = [];
        if (!options[fk.columnName]) options[fk.columnName] = [];
      }
    });
    Promise.all(fetches).then(() => setForeignKeyOptions(options));
  }, [schema, selectedTable, connectionId, endpoint]);

  const handleSend = async () => {
    if (!selectedTable && !endpoint?.graph) {
      setError("Please select a table");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const startTime = Date.now();
      let result;

      // If endpoint has a graph (custom saved endpoint), use preview endpoint
      // Note: Custom saved endpoints use the graph's query definition
      if (endpoint?.graph) {
        // Build limit from pagination settings
        const ps = pageSize ? Number(pageSize) : 100;
        const pn = pageNumber ? Number(pageNumber) : 1;
        const offset = (Math.max(pn, 1) - 1) * ps;
        
        // Build additional filters from user input
        // For saved endpoints, use the source table as the filter table
        const sourceTable = endpoint.graph?.source?.table || selectedTable;
        const additionalFilters = [];
        Object.entries(filters || {}).forEach(([k, v]) => {
          if (v?.val !== "" && v?.val !== undefined) {
            // Parse table.column format or use source table
            let filterTable, filterField;
            if (k.includes('.')) {
              [filterTable, filterField] = k.split('.');
            } else {
              filterTable = sourceTable;
              filterField = k;
            }
            additionalFilters.push({
              field: filterField,
              table: filterTable,
              op: v.op || "eq",
              value: v.val,
            });
          }
        });
        
        // For custom saved endpoints, determine behavior based on method
        const endpointMethod = endpoint?.method || 'GET';
        
        if (endpointMethod === 'GET') {
          // GET: Use preview to fetch data with full graph context (joins, aggregations, etc.)
          result = await api.post(`/connections/${connectionId}/preview`, {
            graph: endpoint.graph,
            limit: ps,
            offset: offset,
            orderBy: orderBy || undefined,
            orderDir: orderDir || 'ASC',
            additionalFilters: additionalFilters.length > 0 ? additionalFilters : undefined,
          });
        } else if (endpointMethod === 'POST') {
          // POST: Create new record using full graph context
          const parsedBody = buildPostPayload();
          result = await api.post(`/connections/${connectionId}/execute`, {
            operation: 'INSERT',
            graph: endpoint.graph,
            data: parsedBody,
            additionalFilters: additionalFilters.length > 0 ? additionalFilters : undefined,
          });
        } else if (endpointMethod === 'PUT') {
          // PUT: Update records using full graph context (joins included for filtering)
          const updateFields = buildPayloadFromBodyFields();
          result = await api.post(`/connections/${connectionId}/execute`, {
            operation: 'UPDATE',
            graph: endpoint.graph,
            data: updateFields,
            additionalFilters: additionalFilters.length > 0 ? additionalFilters : undefined,
          });
        } else if (endpointMethod === 'DELETE') {
          // DELETE: Delete records using full graph context (joins included for filtering)
          if (additionalFilters.length === 0 && (!endpoint.graph?.filters || endpoint.graph.filters.length === 0)) {
            setError('DELETE requires at least one filter to avoid accidental full-table deletes.');
            setLoading(false);
            return;
          }
          result = await api.post(`/connections/${connectionId}/execute`, {
            operation: 'DELETE',
            graph: endpoint.graph,
            additionalFilters: additionalFilters.length > 0 ? additionalFilters : undefined,
          });
        }
      } else {
        // Standard table CRUD - original logic
        const pathParamNames = [];
        let url = `/${connectionId}/${selectedTable}`;
        
        // Build body from bodyFields for POST/PUT
        let parsedBody = null;
        if (operation === "POST") {
          parsedBody = buildPostPayload();
        } else if (operation === "PUT") {
          // For PUT, build payload with update fields and where conditions
          const updateFields = buildPayloadFromBodyFields();
          // Build where conditions from filters
          const where = {};
          Object.entries(filters || {}).forEach(([k, v]) => {
            if (v?.val !== "" && v?.val !== undefined) {
              where[k] = { op: v.op || "eq", val: v.val };
            }
          });
          parsedBody = { data: updateFields, where };
        }

        if (operation === "GET" || operation === "DELETE") {
          const params = new URLSearchParams();
          // add filters (with operators) but exclude any that were used as path params
          Object.entries(filters || {}).forEach(([k, v]) => {
            if (pathParamNames.includes(k)) return; // skip path params
            const op = v?.op || "eq";
            const val = v?.val;
            if (val === undefined || val === "") return;
            const paramName = op === "eq" ? k : `${k}__${op}`;
            params.append(paramName, val);
          });
          if (operation === "GET") {
            if (orderBy) params.append("orderBy", orderBy);
            if (orderDir) params.append("orderDir", orderDir);
            const ps = pageSize ? Number(pageSize) : null;
            const pn = pageNumber ? Number(pageNumber) : 1;
            if (ps) {
              params.append("limit", String(ps));
              const off = (Math.max(pn, 1) - 1) * ps;
              params.append("offset", String(off));
            }
          }
          const qs = params.toString();
          if (qs) url += `?${qs}`;

          if (operation === "DELETE") {
            const hasQueryFilters = !!qs;
            const hasPathParams = pathParamNames && pathParamNames.length > 0;
            if (!hasQueryFilters && !hasPathParams) {
              setError(
                'DELETE requires at least one filter or a path parameter to avoid accidental full-table deletes. Expand "Additional filters" and add a filter.'
              );
              setLoading(false);
              return;
            }
          }
        }

        switch (operation) {
          case "GET":
            result = await api.get(url);
            break;
          case "POST":
            result = await api.post(url, parsedBody);
            break;
          case "PUT": {
            result = await api.put(url, parsedBody);
            break;
          }
          case "DELETE":
            result = await api.delete(url);
            break;
          default:
            throw new Error("Invalid operation");
        }
      }

      const endTime = Date.now();

      setResponse({
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        data: result.data,
        timing: `${endTime - startTime}ms`,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      if (err.response) {
        setResponse({
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
        });
      }
    } finally {
      setLoading(false);
    }
  };
  // Helper to render a filter field for a column (uses shared control)
  // When forBody=true, uses bodyFields state instead of filters
  // tableName is used for building proper filter keys for multi-table endpoints
  function renderFilterField(col, withOperator = true, tableName = null) {
    // Use originalName if available (when col was prefixed), otherwise use col.name
    const originalColName = col.originalName || col.name || "";
    const displayName = col.originalName || col.name;
    
    // Determine if this is for body (POST/PUT) or filters
    const isForBody = tableName !== null && !withOperator;
    const isPost = operation === "POST" || endpoint?.method === "POST";
    
    // Skip password fields for filters and PUT, but allow for POST body
    if (displayName.toLowerCase().includes("password") && !(isForBody && isPost)) return null;

    // Build the filter key - use table prefix if provided (for multi-table endpoints)
    // Use originalColName to avoid double-prefixing when col.name is already prefixed
    const filterKey = tableName ? `${tableName}.${originalColName}` : originalColName;
    
    const op = filters[filterKey]?.op ?? "eq";
    const val = isForBody ? (bodyFields[filterKey] ?? "") : (filters[filterKey]?.val ?? "");
    
    const handleChange = isForBody 
      ? (v) => setBodyFields((f) => ({ ...f, [filterKey]: v }))
      : (v) => setFilters((f) => ({ ...(f || {}), [filterKey]: { ...(f[filterKey] || {}), val: v } }));
    
    return (
      <Box display={"flex"} gap={1} width="100%" key={filterKey}>
        {withOperator && (
          <TextField
            select
            size="small"
            value={op}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                [filterKey]: { ...(f[filterKey] || {}), op: e.target.value },
              }))
            }
            sx={{ width: 160 }}
          >
            {getOperatorsForColumn(col, tableName).map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Box sx={{ flex: 1 }}>
          {renderColumnControl({
            col: { ...col, name: displayName },
            value: val,
            onChange: handleChange,
            schema,
            tableName: tableName || selectedTable,
            foreignKeyOptions,
            label: filterKey, // Show full prefixed name as label
          })}
        </Box>
      </Box>
    );
  }
  const getMethodColor = (method) => {
    const colors = {
      GET: "success",
      POST: "info",
      PUT: "warning",
      DELETE: "error",
    };
    return colors[method] || "default";
  };

  const handleFilterValueChange = useCallback((colName, value) => {
    setFilters((f) => ({
      ...(f || {}),
      [colName]: { ...((f || {})[colName] || {}), val: value },
    }));
  }, []);

  const handleFilterOpChange = useCallback((colName, op) => {
    setFilters((f) => ({
      ...(f || {}),
      [colName]: { ...((f || {})[colName] || {}), op },
    }));
  }, []);

  if (!schema) {
    return (
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 4, 
          textAlign: "center",
          borderRadius: 3,
          borderStyle: "dashed",
        }}
      >
        <Typography color="text.secondary">
          No schema loaded. Please introspect a database first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box data-tour="api-tester">
      {/* Header with endpoint info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SendIcon sx={{ color: "white", fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700}>API Tester</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
              <Chip
                label={operation}
                size="small"
                color={getMethodColor(operation)}
                sx={{ fontWeight: 600, height: 24 }}
              />
              <Typography 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  color: "text.secondary",
                }}
              >
                {endpoint?.path || `/${connectionId}/${selectedTable}`}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {(operation === "POST" || operation === "PUT" || endpoint?.method === "POST" || endpoint?.method === "PUT") && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
            {(operation === "POST" || endpoint?.method === "POST") ? "Request Body" : "Fields to Update"}
          </Typography>
          <Box display={"flex"} flexDirection={"column"} gap={2}>
            {schema && (() => {
              const isPut = operation === "PUT" || endpoint?.method === "PUT";
              
              // Collect tables to render fields for
              // For PUT: only source table (can't update joined tables)
              // For POST: all tables (source + joined)
              const tablesToRender = [];
              if (endpoint?.graph?.source?.table) {
                tablesToRender.push(endpoint.graph.source.table);
                // Only include joined tables for POST, not PUT
                if (!isPut) {
                  (endpoint.graph.joins || []).forEach(j => {
                    const toTable = j.to?.table || j.toTable || j.to;
                    const fromTable = j.from?.table || j.fromTable || j.from;
                    if (toTable && !tablesToRender.includes(toTable)) tablesToRender.push(toTable);
                    if (fromTable && !tablesToRender.includes(fromTable)) tablesToRender.push(fromTable);
                  });
                }
              } else if (selectedTable) {
                tablesToRender.push(selectedTable);
              }
              
              // Get outputFields from endpoint if available (user-selected fields in Builder)
              const endpointOutputFields = endpoint?.graph?.outputFields || endpoint?.outputFields;
              
              return tablesToRender.map(table => {
                const cols = schema[table]?.columns || [];
                const pks = schema[table]?.primaryKeys || [];
                const fks = (schema[table]?.foreignKeys || []).map(fk => fk.columnName);
                const prefix = tablesToRender.length > 1 ? `${table}.` : '';
                
                // If endpoint has outputFields, only show those fields
                const selectedFieldsForTable = endpointOutputFields?.[table];
                
                return (
                  <React.Fragment key={table}>
                    {tablesToRender.length > 1 && (
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 1 }}>
                        {table}
                      </Typography>
                    )}
                    {cols.map((col) => {
                      // If outputFields exist for this table, only show selected fields
                      if (selectedFieldsForTable && !selectedFieldsForTable.includes(col.name)) return null;
                      
                      const isPk = pks.includes(col.name);
                      const isFk = fks.includes(col.name);
                      const name = (col.name || "").toLowerCase();
                      const isPost = operation === "POST" || endpoint?.method === "POST";
                      // Skip password fields only for PUT (updates), show them for POST (new records)
                      if (name.includes("password") && !isPost) return null;
                      if (isPk && !isFk) return null;
                      
                      // Create a modified col object with prefixed name for multi-table
                      const colWithPrefix = tablesToRender.length > 1 
                        ? { ...col, name: prefix + col.name, originalName: col.name }
                        : col;
                      
                      return renderFilterField(colWithPrefix, false, table);
                    })}
                  </React.Fragment>
                );
              });
            })()}
          </Box>
        </Paper>
      )}

      {operation !== "POST" && (
        <Box data-tour="api-tester-filters">
        <AdditionalFiltersToggle
          schema={schema}
          selectedTable={selectedTable}
          filtersCollapsed={filtersCollapsed}
          setFiltersCollapsed={setFiltersCollapsed}
          filters={filters}
          handleFilterValueChange={handleFilterValueChange}
          handleFilterOpChange={handleFilterOpChange}
          orderBy={orderBy}
          setOrderBy={setOrderBy}
          orderDir={orderDir}
          setOrderDir={setOrderDir}
          pageSize={pageSize}
          setPageSize={setPageSize}
          pageNumber={pageNumber}
          setPageNumber={setPageNumber}
          foreignKeyOptions={foreignKeyOptions}
          operation={operation}
          renderFilterField={renderFilterField}
          endpoint={endpoint}
        />
        </Box>
      )}

      {/* Send Button */}
      <Button
        variant="contained"
        onClick={handleSend}
        disabled={loading}
        fullWidth
        size="large"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
        sx={{ 
          mb: 3, 
          py: 1.5, 
          borderRadius: 2,
          textTransform: "none",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        {loading ? "Sending..." : "Send Request"}
      </Button>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3, borderRadius: 2 }}
          icon={<ErrorIcon />}
        >
          {error}
        </Alert>
      )}

      {response && (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }} data-tour="api-tester-response">
          <Box 
            sx={{ 
              p: 2, 
              borderBottom: 1, 
              borderColor: "divider",
              bgcolor: response.status >= 200 && response.status < 300 
                ? alpha(theme.palette.success.main, 0.1)
                : alpha(theme.palette.error.main, 0.1),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {response.status >= 200 && response.status < 300 ? (
                <CheckCircleIcon sx={{ color: "success.main" }} />
              ) : (
                <ErrorIcon sx={{ color: "error.main" }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Response
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={`${response.status} ${response.statusText}`}
                    size="small"
                    color={response.status >= 200 && response.status < 300 ? "success" : "error"}
                    sx={{ fontWeight: 600, height: 24 }}
                  />
                  {response.timing && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography variant="caption" color="text.secondary">
                        {response.timing}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Response Body
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                bgcolor: "grey.900",
                p: 2,
                borderRadius: 2,
                overflow: "auto",
                maxHeight: 400,
              }}
            >
              <ReactJson
                src={response.data}
                theme="monokai"
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
                collapsed={1}
                style={{ backgroundColor: 'transparent' }}
              />
            </Paper>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default APITester;
