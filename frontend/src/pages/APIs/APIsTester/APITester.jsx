import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import ReactJson from "@microlink/react-json-view";
import { getSchema, listRecords } from "../../../services/api";
import api from "../../../services/api";
import GetOptionsPanel from "./GetOptionsPanel";
import { renderColumnControl, formatRowSummary } from "../../../_shared/database/utils";

const APITester = ({ connectionId, endpoint, open, onClose }) => {
  const [schema, setSchema] = useState(null);
  // For cross-table endpoints (e.g., /products/by_order_id/:order_id)
  const [selectedTable, setSelectedTable] = useState(
    endpoint?.table || endpoint?.tableName || ""
  );
  const [operation, setOperation] = useState(endpoint?.method || "GET");
  const [recordId, setRecordId] = useState("");
  const [requestBody, setRequestBody] = useState("{}");
  const [bodyFields, setBodyFields] = useState({});
  const [nextAutoId, setNextAutoId] = useState(null);
  const [foreignKeyOptions, setForeignKeyOptions] = useState({});

  // use shared helpers for row summaries and field rendering

  const [filters, setFilters] = useState({});
  // Path params extracted from endpoint.path (e.g. :order_id) - shown separately from WHERE filters
  const [pathParams, setPathParams] = useState({});
  // Additional filters are collapsed by default
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const OPERATORS = [
    { value: "eq", label: "=" },
    { value: "contains", label: "contains" },
    { value: "gt", label: ">" },
    { value: "gte", label: ">=" },
    { value: "lt", label: "<" },
    { value: "lte", label: "<=" },
  ];
  const [pageSize, setPageSize] = useState("");
  const [pageNumber, setPageNumber] = useState("1");
  const [orderBy, setOrderBy] = useState("");
  const [orderDir, setOrderDir] = useState("ASC");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pathParamErrors, setPathParamErrors] = useState({});
  // Removed activeTab and setActiveTab, only Test API tab remains
  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      try {
        const data = await getSchema(connectionId);
        setSchema(data);
        // Use table from endpoint if provided
        if (endpoint?.table || endpoint?.tableName) {
          setSelectedTable(endpoint.table || endpoint.tableName);
        } else if (Object.keys(data).length > 0) {
          setSelectedTable(Object.keys(data)[0]);
        }
        // Use method from endpoint if provided
        if (endpoint?.method) {
          setOperation(endpoint.method);
        }
      } catch (err) {
        console.error("Error loading schema:", err);
      }
    };
    loadSchema();
  }, [connectionId, endpoint]);

  // Initialize filter inputs when selectedTable or schema changes
  useEffect(() => {
    if (!schema || !selectedTable) return;
    const cols = schema[selectedTable]?.columns || [];
    const obj = {};
    cols.forEach((c) => {
      if ((c.name || "").toLowerCase().includes("password")) return;
      obj[c.name] = { op: "eq", val: "" };
    });
    // remove any keys that are path params
    Object.keys(pathParams || {}).forEach((pn) => delete obj[pn]);
    setFilters(obj);
    setOrderBy("");
    setOrderDir("ASC");
    setPageSize("");
    setPageNumber("1");
  }, [schema, selectedTable, pathParams]);

  // Parse any :params from endpoint.path and place them in `pathParams` (exclude them from WHERE filters)
  useEffect(() => {
    if (!endpoint?.path || !schema) return;
    const pathParamMatches = endpoint.path.match(/:([a-zA-Z0-9_]+)/g) || [];
    const paramNames = pathParamMatches.map((p) => p.slice(1));
    // initialize pathParams from existing filters if present
    setPathParams((prev) => {
      const next = { ...prev };
      paramNames.forEach((pn) => {
        if (!(pn in next)) {
          next[pn] = filters[pn]?.val ?? "";
        }
      });
      // Remove any path params that are no longer present
      Object.keys(next).forEach((k) => {
        if (!paramNames.includes(k)) delete next[k];
      });
      return next;
    });
    // reset param errors when path changes
    setPathParamErrors({});

    // Ensure referenced and join/target columns are present in filters (but exclude path params)
    const crossMatch = endpoint.path.match(
      /\/([a-zA-Z0-9_]+)\/by_([a-zA-Z0-9_]+)\/:([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/
    );
    if (crossMatch) {
      const refTable = crossMatch[1];
      const fkCol = crossMatch[2];
      const targetTable = crossMatch[4];
      let joinTable = Object.keys(schema).find((t) => {
        const fks = schema[t]?.foreignKeys || [];
        return (
          fks.some(
            (fk) => fk.columnName === fkCol && fk.foreignTable === refTable
          ) && fks.some((fk) => fk.foreignTable === targetTable)
        );
      });
      const cols = [
        ...(schema[refTable]?.columns || []),
        ...(joinTable
          ? schema[joinTable]?.columns || []
          : schema[targetTable]?.columns || []),
      ];
      setFilters((prev) => {
        const next = { ...prev };
        cols.forEach((c) => {
          if (paramNames.includes(c.name)) return; // exclude path params
          if (!(c.name in next)) next[c.name] = { op: "eq", val: "" };
        });
        // ensure fkCol is present as path param if not in filters
        if (paramNames.includes(fkCol) && !(fkCol in prev)) {
          // already handled via pathParams
        }
        return next;
      });
    }
  }, [endpoint?.path, schema]);

  // Initialize bodyFields for POST/PUT based on column types (exclude PK and sensitive fields)
  useEffect(() => {
    if (!schema || !selectedTable) return;
    if (operation !== "POST" && operation !== "PUT") return;
    const cols = schema[selectedTable]?.columns || [];
    const pk =
      schema[selectedTable]?.primaryKeys &&
      schema[selectedTable].primaryKeys[0];
    const pkCol = cols.find((c) => c.name === pk);
    const body = {};
    // If PK is auto-increment, fetch its next value from backend
    if (pkCol && pkCol.isAutoIncrement) {
      // Fetch next auto-increment value
      fetch(
        `/api/next-auto-increment?connectionId=${connectionId}&table=${selectedTable}`
      )
        .then((res) => res.json())
        .then((data) => {
          setNextAutoId(data.nextAutoIncrement);
          setBodyFields((prev) => ({ ...prev, [pk]: data.nextAutoIncrement }));
        })
        .catch(() => {
          setNextAutoId("(auto)");
          setBodyFields((prev) => ({ ...prev, [pk]: "" }));
        });
    } else if (pkCol) {
      body[pk] = "";
    }
    cols.forEach((c) => {
      if (c.name === pk) return; // PK handled above
      const name = (c.name || "").toLowerCase();
      if (name.includes("password")) return; // skip sensitive
      const type = (c.type || "").toLowerCase();
      let def = c.default;
      if (typeof def === "string" && def.includes("::")) {
        def = def.split("::")[0];
        if (def.startsWith("'") && def.endsWith("'")) {
          def = def.slice(1, -1);
        }
      }
      if (Array.isArray(c.enumOptions) && c.enumOptions.length > 0) {
        body[c.name] = c.enumOptions[0] ?? "";
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
        body[c.name] = "";
      } else if (["bool", "boolean"].some((t) => type.includes(t))) {
        body[c.name] = "";
      } else if (
        ["date", "timestamp", "datetime"].some((t) => type.includes(t))
      ) {
        body[c.name] = "";
      } else {
        body[c.name] = def ?? "";
      }
    });
    setBodyFields(body);
  }, [schema, selectedTable, operation]);

  const buildPayloadFromBodyFields = () => {
    if (!schema || !selectedTable) return {};
    const cols = schema[selectedTable]?.columns || [];
    const payload = {};
    Object.entries(bodyFields || {}).forEach(([k, v]) => {
      if (v === "" || v === undefined) return; // skip empty
      const col = cols.find((c) => c.name === k);
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
    if (!schema || !selectedTable) return {};
    const cols = schema[selectedTable]?.columns || [];
    const pk = schema[selectedTable]?.primaryKeys?.[0];
    const payload = {};
    Object.entries(bodyFields || {}).forEach(([k, v]) => {
      const col = cols.find((c) => c.name === k);
      if (!col) return;
      // Exclude PK if auto-increment, and password fields
      if (
        (col.name === pk && col.isAutoIncrement) ||
        (col.name || "").toLowerCase().includes("password")
      )
        return;
      if (v === "" || v === undefined) return;
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

  // Load foreign key options for dropdowns when selectedTable changes
  useEffect(() => {
    if (!schema || !selectedTable || !connectionId) return;
    const fks = schema[selectedTable]?.foreignKeys || [];
    const options = {};
    const fetches = fks.map(async (fk) => {
      try {
        const rows = await listRecords(connectionId, fk.foreignTable, {
          limit: 1000,
        });
        options[fk.columnName] = rows;
      } catch (e) {
        options[fk.columnName] = [];
      }
    });
    Promise.all(fetches).then(() => setForeignKeyOptions(options));
  }, [schema, selectedTable, connectionId]);

  const handleSend = async () => {
    if (!selectedTable) {
      setError("Please select a table");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
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
      // Build URL: prefer explicit endpoint.path (from EndpointExplorer) which may include path params, otherwise use table root
      let url;
      const pathParamNames = [];
      if (endpoint?.path) {
        // endpoint.path may include leading /api and connectionId; remove leading /api to work with api baseURL
        let path = endpoint.path;
        if (path.startsWith("/api")) path = path.slice(4);
        // Replace any :params with values from filters/recordId/bodyFields
        const paramMatches = path.match(/:([a-zA-Z0-9_]+)/g) || [];
        for (const pm of paramMatches) {
          const param = pm.slice(1);
          pathParamNames.push(param);
          const val =
            pathParams[param] ??
            filters[param]?.val ??
            (param === "id" ? recordId : null) ??
            bodyFields[param];
          if (!val) {
            setError(`Please provide a value for path parameter :${param}`);
            setLoading(false);
            return;
          }
          path = path.replace(`:${param}`, encodeURIComponent(val));
        }
        // path includes connectionId already (EndpointExplorer builds it), but if not, ensure it is present
        if (path.startsWith(`/${connectionId}`)) {
          url = path;
        } else {
          url = `/${connectionId}${path.startsWith("/") ? "" : "/"}${path}`;
        }
        console.debug("APITester: built request URL", {
          url,
          pathParams,
          pathParamNames,
          filters,
        });
      } else {
        url = `/${connectionId}/${selectedTable}`;
      }

      if (operation === "GET" || operation === "DELETE") {
        const params = new URLSearchParams();
        // add filters (with operators) but exclude any that were used as path params
        Object.entries(filters || {}).forEach(([k, v]) => {
          if (pathParamNames.includes(k)) return; // skip path params
          const op = v?.op || "eq";
          const val = v?.val;
          // build param name
          let paramName;
          if (op === "eq") paramName = k;
          else if (op === "contains") paramName = `${k}__like`;
          else paramName = `${k}__${op}`;

          if (val) {
            params.append(paramName, op === "contains" ? `%${val}%` : val);
          }
        });
        if (operation === "GET") {
          if (orderBy) params.append("orderBy", orderBy);
          if (orderDir) params.append("orderDir", orderDir);
          // convert pageSize/pageNumber to limit/offset for backend
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
      }

      let result;
      const startTime = Date.now();

      switch (operation) {
        case "GET":
          result = await api.get(url);
          break;
        case "POST":
          result = await api.post(url, parsedBody);
          break;
        case "PUT": {
          // For PUT, require recordId and append to URL. If not provided, try to get PK from WHERE conditions.
          const pk = schema[selectedTable]?.primaryKeys?.[0];
          let id = recordId || bodyFields[pk];
          if (!id && filters[pk]?.val) {
            id = filters[pk].val;
          }
          if (!id) {
            setError(
              `Please provide a value for the primary key (${pk}) to update (either in the ID field or WHERE conditions).`
            );
            setLoading(false);
            return;
          }
          result = await api.put(`${url}/${id}`, parsedBody);
          break;
        }
        case "DELETE":
          result = await api.delete(url);
          break;
        default:
          throw new Error("Invalid operation");
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
  function renderFilterField(col) {
    const colName = col.name || "";
    if (colName.toLowerCase().includes("password")) return null;

    const op = filters[col.name]?.op ?? "eq";
    const val = filters[col.name]?.val ?? "";

    return (
      <Box display={"flex"} gap={1} width="100%" key={col.name}>
        <TextField
          select
          size="small"
          value={op}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              [col.name]: { ...(f[col.name] || {}), op: e.target.value },
            }))
          }
          sx={{ width: 120 }}
        >
          {OPERATORS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ flex: 1 }}>
          {renderColumnControl({
            col,
            value: val,
            onChange: (v) => setFilters((f) => ({ ...(f || {}), [col.name]: { ...(f[col.name] || {}), val: v } })),
            schema,
            tableName: selectedTable,
            foreignKeyOptions,
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

  const AdditionalFiltersToggle = () => {
    if (!schema || !selectedTable) return null;
    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Button size="small" onClick={() => setFiltersCollapsed((s) => !s)}>
            {filtersCollapsed ? "Show additional filters" : "Hide additional filters"}
          </Button>
        </Grid>

        <Grid item xs={12}>
          <Collapse in={!filtersCollapsed}>
            <Grid container spacing={1}>
              {/* Show filters for referenced table and join table columns for cross-table endpoints */}
              {(() => {
                // Detect cross-table endpoint pattern and capture referenced table, fk column, param name, and target table
                const crossTableMatch =
                  endpoint?.path &&
                  endpoint.path.match(
                    /\/([a-zA-Z0-9_]+)\/by_([a-zA-Z0-9_]+)\/:([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/
                  );
                if (crossTableMatch && schema) {
                  const refTable = crossTableMatch[1]; // e.g., orders
                  const fkCol = crossTableMatch[2]; // e.g., order_id
                  const paramName = crossTableMatch[3]; // e.g., order_id (path param)
                  const targetTable = crossTableMatch[4]; // e.g., products
                  // Ensure fk column object
                  let fkColObj = schema[refTable]?.columns?.find(
                    (c) => c.name === fkCol
                  );
                  // Find join table by looking for a table with both FKs
                  let joinTable = Object.keys(schema).find((t) => {
                    const fks = schema[t]?.foreignKeys || [];
                    return (
                      fks.some(
                        (fk) =>
                          fk.columnName === fkCol && fk.foreignTable === refTable
                      ) && fks.some((fk) => fk.foreignTable === targetTable)
                    );
                  });
                  // Always include referenced table columns
                  const refCols = schema[refTable]?.columns || [];
                  // If join table found, include its columns except fkCol
                  let joinCols = [];
                  if (joinTable) {
                    joinCols = (schema[joinTable]?.columns || []).filter(
                      (c) => c.name !== fkCol
                    );
                  } else {
                    joinCols = (schema[targetTable]?.columns || []).filter(
                      (c) => c.name !== fkCol
                    );
                  }
                  // Remove duplicates by name
                  const seen = new Set();
                  const allCols = [...refCols, ...joinCols].filter((c) => {
                    if (seen.has(c.name)) return false;
                    seen.add(c.name);
                    return true;
                  });
                  // Always include fkCol as filter if not present
                  if (fkColObj && !allCols.some((c) => c.name === fkCol)) {
                    allCols.unshift(fkColObj);
                  }
                  // If still no columns, fallback to showing all columns from referenced and target table
                  if (allCols.length === 0) {
                    const fallbackCols = [
                      ...(schema[refTable]?.columns || []),
                      ...(schema[targetTable]?.columns || []),
                    ].filter((c) => c.name !== fkCol);
                    return fallbackCols
                      .filter((c) => !(c.name in (pathParams || {})))
                      .map((c) => (
                        <Grid item xs={12} md={6} key={c.name}>
                          {renderFilterField(c)}
                        </Grid>
                      ));
                  }
                  // Render filter fields for all columns
                  return allCols
                    .filter((c) => !(c.name in (pathParams || {})))
                    .map((c) => (
                      <Grid item xs={12} md={6} key={c.name}>
                        {renderFilterField(c)}
                      </Grid>
                    ));
                }
                // Single-table GET: show only columns for this table except the FK used in the endpoint
                const fkMatch = endpoint?.path?.match(
                  /by_([a-zA-Z0-9_]+)\/:([a-zA-Z0-9_]+)/
                );
                let excludeCol = fkMatch ? fkMatch[1] : null;
                return (
                  schema &&
                  selectedTable &&
                  (schema[selectedTable]?.columns || [])
                    .filter(
                      (c) =>
                        c.name !== excludeCol && !(c.name in (pathParams || {}))
                    )
                    .map((c) => (
                      <Grid item xs={12} md={6} key={c.name}>
                        {renderFilterField(c)}
                      </Grid>
                    ))
                );
              })()}

              {operation === "GET" && (
                <Grid container item spacing={1} sx={{ mt: 1 }}>
                  <GetOptionsPanel
                    columns={(schema[selectedTable]?.columns || [])}
                    orderBy={orderBy}
                    setOrderBy={setOrderBy}
                    orderDir={orderDir}
                    setOrderDir={setOrderDir}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                  />
                </Grid>
              )}
            </Grid>
          </Collapse>
        </Grid>
      </Grid>
    );
  };

  if (!schema) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography>
          No schema loaded. Please introspect a database first.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        API Testing Playground
      </Typography>

      <Typography
        variant="body2"
        display={"flex"}
        gap={1}
        alignItems={"center"}
        sx={{ fontFamily: "monospace", flex: 1 }}
      >
        <Chip
          label={operation}
          size="small"
          color={getMethodColor(operation)}
        />{" "}
        {endpoint?.path || `/${connectionId}/${selectedTable}`}
      </Typography>
      {/* Common Configuration (Test API only) */}
      {operation === "GET" || operation === "DELETE" ? (
        <>
          {/* Parameters (path params shown separately) */}
          {Object.keys(pathParams || {}).length > 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Parameters
                </Typography>
              </Grid>
              {Object.keys(pathParams).map((p) => (
                <Grid item xs={12} md={6} key={p + "_param"}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`${p} *`}
                    value={pathParams[p] ?? ""}
                    error={!!pathParamErrors[p]}
                    helperText={pathParamErrors[p] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPathParams((pp) => ({ ...pp, [p]: v }));
                      setPathParamErrors((err) => {
                        const copy = { ...err };
                        delete copy[p];
                        return copy;
                      });
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Additional Filters toggle */}
          <AdditionalFiltersToggle />
        </>
      ) : (
        <></>
      )}
      {operation === "POST" && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Typography variant="subtitle2">Request Body</Typography>
          </Grid>
          {/* Render all columns for POST, including PK (disabled if auto-increment) and FKs as dropdowns */}
          {schema &&
            selectedTable &&
            (schema[selectedTable]?.columns || []).map((col) => {
              const pk =
                schema[selectedTable]?.primaryKeys &&
                schema[selectedTable].primaryKeys[0];
              const pkCol = schema[selectedTable]?.columns.find(
                (c) => c.name === pk
              );
              const isPK = col.name === pk;
              const isAuto = pkCol && pkCol.isAutoIncrement;
              const name = (col.name || "").toLowerCase();
              if (name.includes("password")) return null;
              const type = (col.type || "").toLowerCase();
              const fk = schema[selectedTable]?.foreignKeys?.find(
                (fk) => fk.columnName === col.name
              );
              // PK: show disabled if auto-increment
              if (isPK && isAuto) {
                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <TextField
                      fullWidth
                      size="small"
                      label={col.name + " (auto)"}
                      value={
                        nextAutoId !== null
                          ? nextAutoId
                          : bodyFields[col.name] ?? ""
                      }
                      disabled
                    />
                  </Grid>
                );
              }
              // Foreign key dropdown -> searchable Autocomplete
              if (fk) {
                const rawOpts = foreignKeyOptions[col.name];
                const opts = Array.isArray(rawOpts) ? rawOpts : [];
                const valKey = fk.foreignColumn || fk.foreign_column || "id";

                // Loading / empty states
                if (rawOpts === undefined) {
                  return (
                    <Grid item xs={12} md={6} key={col.name}>
                      <TextField
                        fullWidth
                        size="small"
                        label={col.name}
                        value={bodyFields[col.name] ?? ""}
                        disabled
                        helperText="Loading..."
                      />
                    </Grid>
                  );
                }
                if (opts.length === 0) {
                  return (
                    <Grid item xs={12} md={6} key={col.name}>
                      <TextField
                        fullWidth
                        size="small"
                        label={col.name}
                        value={bodyFields[col.name] ?? ""}
                        disabled
                        helperText="No options"
                      />
                    </Grid>
                  );
                }

                const loading = rawOpts === undefined;
                const selectedOption =
                  opts.find((r) => String(r[valKey] ?? r[Object.keys(r || {})[0]] ?? "") === String(bodyFields[col.name] ?? "")) || null;

                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <Autocomplete
                      size="small"
                      options={opts}
                      loading={loading}
                      noOptionsText={loading ? 'Loading...' : 'No options'}
                      getOptionLabel={(row) => {
                        const primary = row[valKey] ?? row[Object.keys(row || {})[0]] ?? '';
                        const summary = formatRowSummary(row, valKey);
                        return primary ? (summary ? `${primary} — ${summary}` : String(primary)) : JSON.stringify(row);
                      }}
                      filterOptions={(options, state) => {
                        const q = state.inputValue.toLowerCase();
                        return options.filter((r) => {
                          const primary = String(r[valKey] ?? Object.values(r || {})[0] ?? '').toLowerCase();
                          if (primary.includes(q)) return true;
                          return Object.values(r || {}).some((v) => String(v ?? '').toLowerCase().includes(q));
                        });
                      }}
                      value={selectedOption}
                      onChange={(e, newVal) => {
                        const v = newVal ? (newVal[valKey] ?? newVal[Object.keys(newVal || {})[0]] ?? '') : '';
                        setBodyFields((b) => ({ ...b, [col.name]: v }));
                      }}
                      isOptionEqualToValue={(opt, valOpt) => {
                        const ov = opt ? (opt[valKey] ?? opt[Object.keys(opt || {})[0]] ?? '') : '';
                        const vv = valOpt ? (valOpt[valKey] ?? valOpt[Object.keys(valOpt || {})[0]] ?? '') : '';
                        return String(ov) === String(vv);
                      }}
                      renderOption={(props, row) => {
                        const { fullWidth, size, indicator, ...rest } = props;
                        return (
                          <li {...rest}>
                            <Tooltip title={<pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(row, null, 2)}</pre>} placement="right">
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Typography variant="body2">{String(row[valKey] ?? Object.values(row || {})[0] ?? '')}</Typography>
                                {formatRowSummary(row, valKey) ? <Typography variant="caption" color="text.secondary">{formatRowSummary(row, valKey)}</Typography> : null}
                              </Box>
                            </Tooltip>
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          size="small"
                          label={col.name}
                          value={bodyFields[col.name] ?? ""}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {loading ? <CircularProgress size={16} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                );
              }
              // Enum
              if (
                Array.isArray(col.enumOptions) &&
                col.enumOptions.length > 0
              ) {
                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={col.name}
                      value={bodyFields[col.name] ?? ""}
                      onChange={(e) =>
                        setBodyFields((b) => ({
                          ...b,
                          [col.name]: e.target.value,
                        }))
                      }
                    >
                      {col.enumOptions.map((ev) => (
                        <MenuItem key={ev} value={ev}>
                          {ev}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                );
              }
              // Boolean
              if (["bool", "boolean"].some((t) => type.includes(t))) {
                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={col.name}
                      value={bodyFields[col.name] ?? ""}
                      onChange={(e) =>
                        setBodyFields((b) => ({
                          ...b,
                          [col.name]: e.target.value,
                        }))
                      }
                    >
                      <MenuItem value="">Unset</MenuItem>
                      <MenuItem value={true}>True</MenuItem>
                      <MenuItem value={false}>False</MenuItem>
                    </TextField>
                  </Grid>
                );
              }
              // Number
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
                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label={col.name}
                      value={bodyFields[col.name] ?? ""}
                      onChange={(e) =>
                        setBodyFields((b) => ({
                          ...b,
                          [col.name]: e.target.value,
                        }))
                      }
                    />
                  </Grid>
                );
              }
              // Date / datetime
              if (
                ["date", "timestamp", "datetime"].some((t) => type.includes(t))
              ) {
                const isDateOnly =
                  type.includes("date") && !type.includes("time");
                return (
                  <Grid item xs={12} md={6} key={col.name}>
                    <TextField
                      fullWidth
                      size="small"
                      type={isDateOnly ? "date" : "datetime-local"}
                      label={col.name}
                      InputLabelProps={{ shrink: true }}
                      value={bodyFields[col.name] ?? ""}
                      onChange={(e) =>
                        setBodyFields((b) => ({
                          ...b,
                          [col.name]: e.target.value,
                        }))
                      }
                    />
                  </Grid>
                );
              }
              // Default text
              return (
                <Grid item xs={12} md={6} key={col.name}>
                  <TextField
                    fullWidth
                    size="small"
                    label={col.name}
                    value={bodyFields[col.name] ?? ""}
                    onChange={(e) =>
                      setBodyFields((b) => ({
                        ...b,
                        [col.name]: e.target.value,
                      }))
                    }
                  />
                </Grid>
              );
            })}
        </Grid>
      )}
      {operation === "PUT" && (
        <Grid container spacing={2}>
          {/* Section 1: Columns to update (except PK and FKs) */}
          <Grid item xs={12}>
            <Typography variant="subtitle2">Fields to Update</Typography>
          </Grid>
          {schema &&
            selectedTable &&
            (schema[selectedTable]?.columns || []).map((col) => {
              const pk = schema[selectedTable]?.primaryKeys?.[0];
              const isFK = (schema[selectedTable]?.foreignKeys || []).some(
                (fk) => fk.columnName === col.name
              );
              if (col.name === pk || isFK) return null;
              const name = (col.name || "").toLowerCase();
              if (name.includes("password")) return null;
              const type = (col.type || "").toLowerCase();
              // Only allow non-PK, non-FK, non-password columns
              return (
                <Grid item xs={12} md={6} key={col.name}>
                  <TextField
                    fullWidth
                    size="small"
                    label={col.name}
                    value={bodyFields[col.name] ?? ""}
                    onChange={(e) =>
                      setBodyFields((b) => ({
                        ...b,
                        [col.name]: e.target.value,
                      }))
                    }
                  />
                </Grid>
              );
            })}

          {/* Section 2b: Additional WHERE filters (collapsed by default) */}
          <Grid item xs={12}>
            <AdditionalFiltersToggle />
          </Grid>
        </Grid>
      )}
      {/* Tab Content */}
      {/* TEST API TAB only */}
      <>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : "Send Request"}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {response && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Response
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Status:</strong> {response.status} {response.statusText}
              </Typography>
              {response.timing && (
                <Typography variant="body2">
                  <strong>Time:</strong> {response.timing}
                </Typography>
              )}
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              Response Body:
            </Typography>
            <Box
              sx={{
                bgcolor: "grey.900",
                p: 2,
                borderRadius: 1,
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
              />
            </Box>
          </Box>
        )}
      </>
    </Paper>
  );
};

export default APITester;
