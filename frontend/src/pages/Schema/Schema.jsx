import React, { useState, useEffect, useContext } from "react";
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
} from "@mui/material";
import {
  Container,
  Grid,
} from "@mui/material";
import {
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord,
} from "../../services/api";
import { useConnection } from "../../_shared/database/useConnection";
import { getConnection } from "../../utils/storage";
import { AppContext } from "../../App";
import { renderColumnControl, getNonFkPrimaryKeys } from "../../_shared/database/utils";
import TablesList from './sections/TablesList';
import DataDialog from './dialogs/DataDialog';
import EditDialog from './dialogs/EditDialog';
import DeleteDialog from './dialogs/DeleteDialog';

const Schema = () => {
  const {
    currentConnection,
    selectConnection,
  } = useConnection();
  const { schema, refreshSchema, isLoadingSchema: loading } = useContext(AppContext);

  const connectionId = currentConnection?.id;
    // Ensure a connection is selected: fallback to lastConnectionId if currentConnection is null
    useEffect(() => {
      try {
        if (!currentConnection) {
          const lastId = localStorage.getItem('lastConnectionId');
          if (lastId) {
            const conn = getConnection(lastId);
            if (conn) {
              selectConnection(conn);
            }
          }
        }
      } catch {}
    }, [currentConnection, selectConnection]);
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

  const openAddDialog = async (tableName) => {
    if (!tableName) return;

    setDataTable(tableName);
    setEditMode("add");
    setEditRow(null);

    // Find PK name
    const pk = schema[tableName]?.primaryKeys && schema[tableName].primaryKeys[0];

    // Prepare FK dropdowns
    const fks = (schema[tableName]?.foreignKeys || []);
    console.log(`[FK DEBUG] Table ${tableName} has ${fks.length} foreign keys:`, fks);
    const fkOptions = {};
    for (const fk of fks) {
      try {
        console.log(`[FK DEBUG] Fetching data from ${fk.foreignTable} for FK column ${fk.columnName}`);
        const rows = await listRecords(connectionId, fk.foreignTable);
        console.log(`[FK DEBUG] Got ${rows?.length || 0} rows from ${fk.foreignTable}`);
        fkOptions[fk.columnName] = rows;
      } catch (err) {
        console.error(`[FK DEBUG] Error fetching FK data from ${fk.foreignTable}:`, err);
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
    // If row is null, we're adding a new row; otherwise editing
    if (!row) {
      return openAddDialog(dataTable);
    }
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

  // Validate required fields for add/edit - returns array of missing field names
  const validateRequiredFields = () => {
    if (!schema || !dataTable) return [];
    
    const cols = schema[dataTable]?.columns || [];
    const pks = schema[dataTable]?.primaryKeys || [];
    const fks = schema[dataTable]?.foreignKeys || [];
    const missingFields = [];
    
    cols.forEach(col => {
      // Skip PKs (usually auto-generated) for add mode
      if (editMode === "add" && pks.includes(col.name)) return;
      
      // Check if field is required (not nullable and no default)
      // FK columns are only required if they are non-nullable without default
      const isNullable = col.nullable === true || col.nullable === 'YES';
      const hasDefault = col.default !== null && col.default !== undefined && col.default !== '';
      const isRequired = !isNullable && !hasDefault;
      
      if (isRequired) {
        const value = editValues[col.name];
        if (value === undefined || value === '' || value === null) {
          missingFields.push(col.name);
        }
      }
    });
    
    return missingFields;
  };

  const handleEditSubmit = async () => {
    setEditLoading(true);
    setEditError(null);
    try {
      // Validate required fields for add mode
      if (editMode === "add") {
        const missingFields = validateRequiredFields();
        if (missingFields.length > 0) {
          setEditError(`Missing required fields: ${missingFields.join(', ')}`);
          setEditLoading(false);
          return;
        }
      }
      
      if (editMode === "add") {
        // Remove non-FK PKs from payload (allow PKs that are also FKs to be provided)
        const nonFkPks = getNonFkPrimaryKeys(schema, dataTable);
        const payload = { ...editValues };
        nonFkPks.forEach((pk) => {
          if (pk) delete payload[pk];
        });
        await createRecord(connectionId, dataTable, payload);
      } else if (editMode === "edit" && editRow) {
        const payload = { ...editValues };
        const pks = schema[dataTable]?.primaryKeys || [];
        let idOrFilters;
        if (pks.length === 1) {
          idOrFilters = editRow[pks[0]];
        } else if (pks.length > 1) {
          // Composite primary key
          idOrFilters = Object.fromEntries(pks.map(pk => [pk, editRow[pk]]));
        } else {
          // No primary keys - use all original row values as filters
          idOrFilters = { ...editRow };
        }
        await updateRecord(connectionId, dataTable, idOrFilters, payload);
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
    const pks = schema[dataTable]?.primaryKeys;
    if (pks && pks.length > 0) {
      // Use primary keys as filters
      setDeleteTargetKey(Object.fromEntries(pks.map(pk => [pk, row[pk]])));
    } else {
      // No primary key - use all columns as filters to identify the row
      setDeleteTargetKey({ ...row });
    }
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
      // Use deleteTargetKey which contains either PK values or all column values for tables without PKs
      if (!deleteTargetKey || Object.keys(deleteTargetKey).length === 0) {
        throw new Error('Could not determine row filters to delete');
      }

      await deleteRecord(connectionId, dataTable, deleteTargetKey);
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

  const renderInputField = (col) => {
    const value = editValues[col.name] ?? "";
    // Robust PK detection: support multiple schema shapes
    const pks = (schema[dataTable]?.primaryKeys || schema[dataTable]?.primaryKey || []);
    const isPrimaryKey = Array.isArray(pks) ? pks.includes(col.name) : false;

    // Hide all primary key fields in both add and edit modes
    if (isPrimaryKey) {
      return null;
    }

    return renderColumnControl({
      col,
      value,
      onChange: (v) => handleEditChange(col.name, v),
      schema,
      tableName: dataTable,
      foreignKeyOptions,
      disabled: false,
    });
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
    } catch { }
  };

  const filteredTables = Object.entries(schema).filter(([tableName]) =>
    tableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 24 }}>📊</span>
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Schema Browser
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Explore tables, columns, and relationships
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 250 }}
            InputProps={{
              sx: { borderRadius: 2 },
            }}
            data-tour="schema-search"
          />
          <Button
            variant="contained"
            onClick={refreshSchema}
            disabled={loading}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              px: 2.5,
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
      </Paper>

      {/* Tables count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filteredTables.length} table{filteredTables.length !== 1 ? "s" : ""} found
      </Typography>

      {/* Tables List */}
      <TablesList
        setDataTable={setDataTable}
        filteredTables={filteredTables}
        schema={schema}
        loading={loading}
        openAddDialog={(tableName) => { setDataTable(tableName); openAddDialog(tableName); }}
        openDataViewer={openDataViewer}
        handleExportTable={handleExportTable}
      />

      <DataDialog
        setDataTable={setDataTable}
        open={dataOpen}
        onClose={closeDataViewer}
        dataTable={dataTable}
        dataRows={dataRows}
        dataLoading={dataLoading}
        dataError={dataError}
        limit={limit}
        setLimit={setLimit}
        offset={offset}
        handlePrevPage={handlePrevPage}
        handleNextPage={handleNextPage}
        dataColumns={dataColumns}
        handleChangeOrder={handleChangeOrder}
        openEditDialog={openEditDialog}
        openDeleteDialog={openDeleteDialog}
        deleteLoading={deleteLoading}
        deleteTargetKey={deleteTargetKey}
        fetchTableData={fetchTableData}
      />
      <EditDialog
        open={editOpen}
        onClose={closeEditDialog}
        tableColumns={tableColumns}
        renderInputField={renderInputField}
        editMode={editMode}
        editError={editError}
        editLoading={editLoading}
        handleEditSubmit={handleEditSubmit}
      />
      <DeleteDialog
        open={deleteConfirmOpen}
        onClose={closeDeleteDialog}
        deleteTargetRow={deleteTargetRow}
        deleteTargetKey={deleteTargetKey}
        deleteError={deleteError}
        deleteLoading={deleteLoading}
        handleDeleteConfirm={handleDeleteConfirm}
      />
    </Box>
  );
};

export default Schema;
