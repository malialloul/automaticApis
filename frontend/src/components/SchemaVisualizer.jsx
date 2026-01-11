import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Select,
  MenuItem,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import KeyIcon from "@mui/icons-material/Key";
import LinkIcon from "@mui/icons-material/Link";
import {
  getSchema,
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} from "../services/api";

const SchemaVisualizer = ({ connectionId }) => {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dataOpen, setDataOpen] = useState(false);
  const [dataTable, setDataTable] = useState(null);
  const [dataRows, setDataRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [orderBy, setOrderBy] = useState("");
  const [orderDir, setOrderDir] = useState("asc");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState("");
  const [editRow, setEditRow] = React.useState(null);
  const [editValues, setEditValues] = React.useState({});
  const [editError, setEditError] = React.useState(null);
  const [editLoading, setEditLoading] = React.useState(false);

  // Delete flow state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetKey, setDeleteTargetKey] = useState(null);
  const [deleteTargetRow, setDeleteTargetRow] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const tableColumns = React.useMemo(() => {
    if (!dataTable || !schema?.[dataTable]) return [];
    return schema[dataTable].columns || [];
  }, [dataTable, schema]);

  const [foreignKeyOptions, setForeignKeyOptions] = useState({});

  // Helper: create a short, human-friendly summary for a row returned for FK dropdowns
  // Simplified: do not prefer specific keys; just list the first few no n-empty columns (excluding the FK value column)
  const formatRowSummary = (row, valKey) => {
    if (!row || typeof row !== "object") return "";
    const pairs = [];
    for (const k of Object.keys(row)) {
      if (k === valKey) continue;
      const v = row[k];
      if (v === undefined || v === null || String(v).trim() === "") continue;
      pairs.push(`${k}: ${String(v)}`);
      if (pairs.length >= 3) break;
    }
    return pairs.join(' • ');
  };

  const openAddDialog = async (tableName) => {
    if (!tableName) return;

    setDataTable(tableName);
    setEditMode("add");
    setEditRow(null);

    // Find PK name
    const pk = schema[tableName]?.primaryKeys && schema[tableName].primaryKeys[0];

    // Prepare FK dropdowns
    const fks = (schema[tableName]?.foreignKeys || []);
    const fkOptions = {};
    for (const fk of fks) {
      try {
        const rows = await listRecords(connectionId, fk.foreignTable);
        fkOptions[fk.columnName] = rows;
      } catch {
        fkOptions[fk.columnName] = [];
      }
    }
    setForeignKeyOptions(fkOptions);

    // Set default values for all non-PK columns
    setEditValues(
      Object.fromEntries(
        (schema[tableName].columns || [])
          .filter((c) => !(pk && c.name === pk && typeof c.default === "string" && c.default.startsWith("nextval")))
          .map((c) => [c.name, c.default ?? ""])
      )
    );
    setEditError(null);
    setEditOpen(true);
  };

  const openEditDialog = async (row) => {
    setEditMode("edit");
    setEditRow(row);
    setEditValues({ ...row });
    setEditError(null);
    // Ensure FK options are loaded so the Autocomplete can show choices in edit mode
    try {
      const tableName = dataTable;
      if (tableName) {
        const fks = (schema[tableName]?.foreignKeys || []);
        const fkOptions = {};
        for (const fk of fks) {
          try {
            const rows = await listRecords(connectionId, fk.foreignTable, { limit: 1000 });
            fkOptions[fk.columnName] = rows;
          } catch {
            fkOptions[fk.columnName] = [];
          }
        }
        setForeignKeyOptions(fkOptions);
      }
    } catch (e) {
      // ignore fetch errors
    }
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    setEditOpen(false);
    setEditRow(null);
    setEditValues({});
    setEditError(null);
    setEditMode("");
  };

  const handleEditChange = (col, value) => {
    setEditValues((v) => ({ ...v, [col]: value }));
  };

  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditError(null);
    try {
      if (editMode === "add") {
        // Remove PK from payload
        const pk = schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0];
        const payload = { ...editValues };
        if (pk) delete payload[pk];
        await createRecord(connectionId, dataTable, payload);
      } else if (editMode === "edit" && editRow) {
        const pk = schema[dataTable].primaryKeys && schema[dataTable].primaryKeys[0];
        await updateRecord(connectionId, dataTable, editRow[pk], editValues);
      }
      closeEditDialog();
      fetchTableData(dataTable, { offset, orderBy, orderDir });
    } catch (err) {
      setEditError(err.response?.data?.error || err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete handlers
  const openDeleteDialog = (row) => {
    const pk = schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0];
    const key = pk ? row[pk] : null;
    setDeleteTargetKey(key);
    setDeleteTargetRow(row);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteConfirmOpen(false);
    setDeleteTargetKey(null);
    setDeleteTargetRow(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const pk = schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0];
      if (!pk) throw new Error('Primary key not found for table');
      const id = deleteTargetKey ?? (deleteTargetRow && deleteTargetRow[pk]);
      if (id === undefined || id === null) throw new Error('Could not determine row id to delete');
      await deleteRecord(connectionId, dataTable, id);
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Row deleted', severity: 'success' } }));
      closeDeleteDialog();
      // Refresh current table data
      fetchTableData(dataTable, { offset, orderBy, orderDir });
    } catch (err) {
      setDeleteError(err.response?.data?.error || err.message || String(err));
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: `Delete failed: ${err.message || err}`, severity: 'error' } }));
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadSchema = async () => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSchema(connectionId);
      setSchema(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };
  const fetchTableData = async (tableName, opts = {}) => {
    if (!connectionId || !tableName) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const params = {
        limit: opts.limit ?? limit,
        offset: opts.offset ?? offset,
        orderBy: (opts.orderBy ?? orderBy) || undefined,
        orderDir: (opts.orderDir ?? orderDir) || undefined,
      };
      const rows = await listRecords(connectionId, tableName, params);
      setDataRows(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setDataError(err.response?.data?.error || err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const openDataViewer = (tableName) => {
    setDataTable(tableName);
    setOffset(0);
    // Prefer a stable default order: primary key or first column
    const tInfo = schema?.[tableName];
    const defaultOrder =
      (tInfo?.primaryKeys && tInfo.primaryKeys[0]) ||
      (tInfo?.columns && tInfo.columns[0]?.name) ||
      "";
    setOrderBy(defaultOrder);
    setOrderDir("asc");
    setDataOpen(true);
    fetchTableData(tableName, {
      offset: 0,
      orderBy: defaultOrder,
      orderDir: "asc",
    });
  };

  const closeDataViewer = () => {
    setDataOpen(false);
    setDataTable(null);
    setDataRows([]);
  };

  const dataColumns = (() => {
    const first = dataRows[0];
    if (!first) return [];
    return Object.keys(first);
  })();

  const handleNextPage = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    fetchTableData(dataTable, { offset: newOffset, orderBy, orderDir });
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, offset - limit);
    setOffset(newOffset);
    fetchTableData(dataTable, { offset: newOffset, orderBy, orderDir });
  };

  const handleChangeOrder = (col) => {
    const newDir = orderBy === col && orderDir === "asc" ? "desc" : "asc";
    setOrderBy(col);
    setOrderDir(newDir);
    fetchTableData(dataTable, { orderBy: col, orderDir: newDir, offset });
  };

  useEffect(() => {
    loadSchema();
  }, [connectionId]);

  const renderInputField = (col) => {
    const value = editValues[col.name] ?? "";
    const commonProps = {
      fullWidth: true,
      size: "small",
      value,
      onChange: (e) => handleEditChange(col.name, e.target.value),
      placeholder: col.type,
      disabled:
        (editMode === "edit" && (schema[dataTable].primaryKeys || []).includes(col.name)),
    };

    const type = col.type.toLowerCase();
    const name = col.name.toLowerCase();

    // Hide PK field in add mode
    if (editMode === "add" && (schema[dataTable].primaryKeys || []).includes(col.name)) {
      return null;
    }

    // Foreign key dropdown (robust to undefined / unexpected row shapes)
    const fk = (schema[dataTable]?.foreignKeys || []).find(fk => fk.columnName === col.name);
    if (fk && (editMode === "add" || editMode === "edit")) {
      const rawOpts = foreignKeyOptions[col.name];
      const loading = rawOpts === undefined;
      const opts = Array.isArray(rawOpts) ? rawOpts : [];
      const valKey = fk.foreignColumn || fk.foreign_column || "id";
      const selectedOption = opts.find((r) => {
        const v = r[valKey] ?? r[Object.keys(r || {})[0]] ?? "";
        return String(v) === String(value);
      }) || null;

      return (
        <Autocomplete
          size="small"
          options={opts}
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
            handleEditChange(col.name, v);
          }}
          isOptionEqualToValue={(opt, valOpt) => {
            const ov = opt ? (opt[valKey] ?? opt[Object.keys(opt || {})[0]] ?? '') : '';
            const vv = valOpt ? (valOpt[valKey] ?? valOpt[Object.keys(valOpt || {})[0]] ?? '') : '';
            return String(ov) === String(vv);
          }}
          renderOption={(props, row) => (
            <li {...props}>
              <Tooltip title={<pre style={{whiteSpace: 'pre-wrap', margin: 0}}>{JSON.stringify(row, null, 2)}</pre>} placement="right">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2">{String(row[valKey] ?? Object.values(row || {})[0] ?? '')}</Typography>
                  {formatRowSummary(row, valKey) ? <Typography variant="caption" color="text.secondary">{formatRowSummary(row, valKey)}</Typography> : null}
                </Box>
              </Tooltip>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              {...commonProps}
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
      );
    }

    // Password field
    if (name.includes("password")) {
      return <TextField {...commonProps} type="password" />;
    }

    // Email field
    if (name.includes("email")) {
      return <TextField {...commonProps} type="email" />;
    }

    // Number fields
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
      ].some((t) => type.includes(t))
    ) {
      return <TextField {...commonProps} type="number" />;
    }

    // Boolean fields
    if (["bool", "boolean"].some((t) => type.includes(t))) {
      return (
        <Select
          {...commonProps}
          value={value === "" ? "" : Boolean(value)}
          onChange={(e) =>
            handleEditChange(
              col.name,
              e.target.value === "true" || e.target.value === true
            )
          }
        >
          <MenuItem value={true}>True</MenuItem>
          <MenuItem value={false}>False</MenuItem>
        </Select>
      );
    }

    // Enum fields (general)
    if (Array.isArray(col.enumOptions) && col.enumOptions.length > 0) {
      return (
        <Select
          {...commonProps}
          value={value}
          onChange={(e) => handleEditChange(col.name, e.target.value)}
        >
          {col.enumOptions.map((ev) => (
            <MenuItem key={ev} value={ev}>
              {ev}
            </MenuItem>
          ))}
        </Select>
      );
    }

    // Date / Timestamp fields
    if (["date", "timestamp", "datetime"].some((t) => type.includes(t))) {
      return <TextField {...commonProps} type="datetime-local" />;
    }

    // Default to text
    return <TextField {...commonProps} type="text" />;
  };

  const handleExportTable = (tableName) => {
    try {
      const tableInfo = schema?.[tableName];
      if (!tableInfo) return;
      const blob = new Blob([JSON.stringify(tableInfo, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tableName}-schema.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  if (!connectionId) {
    return (
      <Alert severity="info">Please select a connection to view schema</Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!schema) {
    return <Alert severity="warning">No schema found</Alert>;
  }

  const filteredTables = Object.entries(schema).filter(([tableName]) =>
    tableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 2,
        }}
      >
        <Typography variant="h5" gutterBottom>
          Database Schema
        </Typography>
        <Button variant="outlined" onClick={loadSchema} disabled={loading}>
          Refresh Schema
        </Button>
      </Box>

      <TextField
        fullWidth
        placeholder="Search tables..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {filteredTables.length} table(s) found
      </Typography>

      {filteredTables.map(([tableName, tableInfo]) => (
        <Accordion key={tableName} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                width: "100%",
              }}
            >
              <Typography variant="h6">{tableName}</Typography>
              <Chip
                label={`${tableInfo.columns.length} columns`}
                size="small"
              />
              {tableInfo.foreignKeys?.length > 0 && (
                <Chip
                  label={`${tableInfo.foreignKeys.length} FK`}
                  size="small"
                  color="primary"
                  icon={<LinkIcon />}
                />
              )}
              {tableInfo.reverseForeignKeys?.length > 0 && (
                <Chip
                  label={`${tableInfo.reverseForeignKeys.length} reverse FK`}
                  size="small"
                  color="secondary"
                  icon={<LinkIcon />}
                />
              )}
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Add row">
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDataTable(tableName); // set the current table

                      openAddDialog(tableName);
                    }}
                  >
                    Add
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="View data">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDataViewer(tableName);
                    }}
                  >
                    View Data
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="Export table schema">
                <span>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportTable(tableName);
                    }}
                  >
                    <span role="img" aria-label="export">
                      📤
                    </span>
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </AccordionSummary>

          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Column</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Nullable</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Keys</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableInfo.columns.map((column) => {
                    const isPK = tableInfo.primaryKeys?.includes(column.name);
                    const fk = tableInfo.foreignKeys?.find(
                      (fk) => fk.columnName === column.name
                    );

                    return (
                      <TableRow key={column.name}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={isPK ? "bold" : "normal"}
                          >
                            {column.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={column.type}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{column.nullable ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {column.default || "-"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {isPK && (
                            <Chip
                              label="PK"
                              size="small"
                              color="success"
                              icon={<KeyIcon />}
                            />
                          )}
                          {fk && (
                            <Chip
                              label={`FK → ${fk.foreignTable}`}
                              size="small"
                              color="primary"
                              sx={{ ml: 0.5 }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {tableInfo.reverseForeignKeys?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Referenced By:
                </Typography>
                {tableInfo.reverseForeignKeys.map((rfk, idx) => (
                  <Chip
                    key={idx}
                    label={`${rfk.referencingTable} (${rfk.referencingColumn})`}
                    size="small"
                    sx={{ m: 0.5 }}
                    color="secondary"
                  />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      <Dialog open={dataOpen} onClose={closeDataViewer} fullWidth maxWidth="lg">
        <DialogTitle>{dataTable ? `Data: ${dataTable}` : "Data"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => openAddDialog(dataTable)}
              sx={{ mr: 2 }}
            >
              Add
            </Button>
            <Typography variant="body2">Limit</Typography>
            <Select
              size="small"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
                fetchTableData(dataTable, {
                  limit: Number(e.target.value),
                  offset: 0,
                });
              }}
            >
              {[10, 25, 50, 100].map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="body2" sx={{ ml: 2 }}>
              Offset
            </Typography>
            <Typography variant="body2">{offset}</Typography>
            <Button
              size="small"
              onClick={handlePrevPage}
              disabled={offset === 0 || dataLoading}
            >
              Prev
            </Button>
            <Button
              size="small"
              onClick={handleNextPage}
              disabled={dataLoading || dataRows.length < limit}
            >
              Next
            </Button>
            {dataError && (
              <Typography variant="body2" color="error">
                {dataError}
              </Typography>
            )}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                {dataColumns.map((col) => (
                  <TableCell
                    key={col}
                    onClick={() => handleChangeOrder(col)}
                    sx={{ cursor: "pointer" }}
                  >
                    {col}{" "}
                    {orderBy === col ? (orderDir === "asc" ? "↑" : "↓") : ""}
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dataLoading ? (
                <TableRow>
                  <TableCell colSpan={dataColumns.length + 1}>
                    <Typography variant="body2">Loading…</Typography>
                  </TableCell>
                </TableRow>
              ) : dataRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={dataColumns.length + 1}>
                    <Typography variant="body2" color="text.secondary">
                      No data
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                dataRows.map((row, idx) => (
                  <TableRow key={idx}>
                    {dataColumns.map((col) => (
                      <TableCell key={col}>
                        {row[col] === null || row[col] === undefined
                          ? "—"
                          : String(row[col])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEditDialog(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => openDeleteDialog(row)}
                          disabled={deleteLoading && deleteTargetKey === (schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0] ? row[schema[dataTable].primaryKeys[0]] : undefined)}
                        >
                          {deleteLoading && deleteTargetKey === (schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0] ? row[schema[dataTable].primaryKeys[0]] : undefined) ? <CircularProgress size={16} /> : 'Delete'}
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDataViewer}>Close</Button>
        </DialogActions>
      </Dialog>
      {editOpen && (
        <Dialog
          open={editOpen}
          onClose={closeEditDialog}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {editMode === "add" ? "Add Row" : "Edit Row"}
          </DialogTitle>
          <DialogContent dividers>
            {tableColumns.map((col) => {
              const input = renderInputField(col);
              if (input === null) return null;
              return (
                <Box key={col.name} sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {col.name}
                  </Typography>
                  {input}
                </Box>
              );
            })}
            {editError && <Typography color="error">{editError}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog}>Cancel</Button>
            <Button
              onClick={handleEditSubmit}
              variant="contained"
              disabled={editLoading}
            >
              {editMode === "add" ? "Add" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog open={deleteConfirmOpen} onClose={closeDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>Confirm delete</DialogTitle>
        <DialogContent dividers>
          <Typography>Are you sure you want to delete this row?</Typography>
          {deleteTargetRow ? (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption">Key: {String(deleteTargetKey)}</Typography>
              <pre style={{whiteSpace: 'pre-wrap', marginTop: 8}}>{JSON.stringify(deleteTargetRow, null, 2)}</pre>
            </Box>
          ) : null}
          {deleteError && <Typography color="error">{deleteError}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleteLoading}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SchemaVisualizer;
