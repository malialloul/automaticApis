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
import { AppContext } from "../../App";
import { renderColumnControl, getNonFkPrimaryKeys } from "../../_shared/database/utils";
import TablesList from './sections/TablesList';
import DataDialog from './dialogs/DataDialog';
import EditDialog from './dialogs/EditDialog';
import DeleteDialog from './dialogs/DeleteDialog';

const Schema = () => {
  const {
    currentConnection,
  } = useConnection();
  const { schema, refreshSchema, isLoadingSchema: loading } = useContext(AppContext);

  const connectionId = currentConnection?.id;
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
        // Remove non-FK PKs from payload (allow PKs that are also FKs to be provided)
        const nonFkPks = getNonFkPrimaryKeys(schema, dataTable);
        const payload = { ...editValues };
        nonFkPks.forEach((pk) => {
          if (pk) delete payload[pk];
        });
        await createRecord(connectionId, dataTable, payload);
      } else if (editMode === "edit" && editRow) {
        const payload = { ...editValues };
        const pks = schema[dataTable].primaryKeys;
        let idOrFilters;
        if (pks.length === 1) {
          idOrFilters = editRow[pks[0]];
        } else {
          idOrFilters = Object.fromEntries(pks.map(pk => [pk, editRow[pk]]));
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
    const pks = schema[dataTable]?.primaryKeys
    setDeleteTargetKey(pks ? Object.fromEntries(pks.map(pk => [pk, row[pk]])) : null);
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
      // Determine whether we have a composite PK object or a single id
      if (!schema[dataTable]?.primaryKeys || schema[dataTable].primaryKeys.length === 0) throw new Error('Primary key not found for table');

      let payloadOrId = deleteTargetKey ?? (deleteTargetRow && deleteTargetRow[schema[dataTable].primaryKeys[0]]);
      if (payloadOrId === undefined || payloadOrId === null) throw new Error('Could not determine row id to delete');

      await deleteRecord(connectionId, dataTable, payloadOrId);
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
    // Check if column is a primary key and whether it's also a foreign key
    const isPK = getNonFkPrimaryKeys(schema, dataTable).includes(col.name);

    // Hide PK field in add mode only if it's a PK that is NOT also a FK
    if (editMode === "add" && isPK) {
      return null;
    }

    // In edit mode, disable PKs that are NOT FKs; allow editing PKs that are also FKs
    const disabled = (editMode === "edit" && isPK);

    return renderColumnControl({
      col,
      value,
      onChange: (v) => handleEditChange(col.name, v),
      schema,
      tableName: dataTable,
      foreignKeyOptions,
      disabled,
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
