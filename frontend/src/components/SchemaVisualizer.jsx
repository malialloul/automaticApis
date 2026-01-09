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
  const tableColumns = React.useMemo(() => {
    if (!dataTable || !schema?.[dataTable]) return [];
    return schema[dataTable].columns || [];
  }, [dataTable, schema]);

  const openAddDialog = async () => {
    setEditMode("add");
    setEditRow(null);
    let nextId = "";
    const pk = schema[dataTable]?.primaryKeys && schema[dataTable].primaryKeys[0];
    if (
      pk &&
      tableColumns.length &&
      typeof tableColumns.find((c) => c.name === pk)?.default === "string" &&
      tableColumns.find((c) => c.name === pk).default.startsWith("nextval")
    ) {
      let maxId = null;
      if (dataRows && dataRows.length > 0 && dataRows[0][pk] !== undefined) {
        maxId = Math.max(...dataRows.map((r) => Number(r[pk] || 0)));
      } else {
        try {
          // Fetch only the latest row for PK
          const latestRows = await listRecords(connectionId, dataTable, {
            limit: 1,
            orderBy: pk,
            orderDir: "desc",
          });
          if (Array.isArray(latestRows) && latestRows.length > 0) {
            maxId = Number(latestRows[0][pk] || 0);
          }
        } catch {}
      }
      nextId = maxId !== null && !isNaN(maxId) ? String(maxId + 1) : "";
    }
    setEditValues(
      Object.fromEntries(
        tableColumns.map((c) => {
          if (
            pk &&
            c.name === pk &&
            typeof c.default === "string" &&
            c.default.startsWith("nextval")
          ) {
            return [c.name, nextId];
          }
          return [c.name, c.default ?? ""];
        })
      )
    );
    setEditError(null);
    setEditOpen(true);
  };

  const openEditDialog = (row) => {
    setEditMode("edit");
    setEditRow(row);
    setEditValues({ ...row });
    setEditError(null);
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
        await createRecord(connectionId, dataTable, editValues);
      } else if (editMode === "edit" && editRow) {
        const pk =
          schema[dataTable].primaryKeys && schema[dataTable].primaryKeys[0];
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
                    
                      openAddDialog();
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
              onClick={openAddDialog}
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
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openEditDialog(row)}
                      >
                        Edit
                      </Button>
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
            {tableColumns.map((col) => (
              <Box key={col.name} sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {col.name}
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={editValues[col.name] ?? ""}
                  onChange={(e) => handleEditChange(col.name, e.target.value)}
                  disabled={
                    (editMode === "edit" &&
                      (schema[dataTable].primaryKeys || []).includes(
                        col.name
                      )) ||
                    (editMode === "add" &&
                      (schema[dataTable].primaryKeys || []).includes(col.name))
                  }
                  placeholder={col.type}
                />
              </Box>
            ))}
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
    </Paper>
  );
};

export default SchemaVisualizer;
