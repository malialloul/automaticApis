import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Divider,
  Alert,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Key as KeyIcon,
  Link as LinkIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ViewColumn as ColumnIcon,
  Speed as IndexIcon,
} from '@mui/icons-material';
import { schemaBuilder } from '../../../services/api';

const TableDesigner = ({ connectionId, table, details, onUpdate, allTables }) => {
  const [columns, setColumns] = useState([]);
  const [constraints, setConstraints] = useState([]);
  const [indexes, setIndexes] = useState([]);
  const [dataTypes, setDataTypes] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialogs
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [constraintDialogOpen, setConstraintDialogOpen] = useState(false);
  const [indexDialogOpen, setIndexDialogOpen] = useState(false);
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [pendingSql, setPendingSql] = useState('');

  useEffect(() => {
    if (details) {
      setColumns(details.columns || []);
      setConstraints(details.constraints || []);
      setIndexes(details.indexes || []);
    }
  }, [details]);

  useEffect(() => {
    if (connectionId) {
      schemaBuilder.getDataTypes(connectionId).then(res => {
        setDataTypes(res.dataTypes || []);
      }).catch(() => {});
    }
  }, [connectionId]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddColumn = () => {
    setEditingColumn(null);
    setColumnDialogOpen(true);
  };

  const handleEditColumn = (column) => {
    setEditingColumn(column);
    setColumnDialogOpen(true);
  };

  const handleDeleteColumn = async (columnName) => {
    try {
      const result = await schemaBuilder.dropColumn(connectionId, table.name, columnName, table.schema, true);
      setPendingSql(result.sql);
      setSqlPreviewOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteConstraint = async (constraintName) => {
    try {
      const result = await schemaBuilder.dropConstraint(connectionId, table.name, constraintName, table.schema, true);
      setPendingSql(result.sql);
      setSqlPreviewOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleDeleteIndex = async (indexName) => {
    try {
      const result = await schemaBuilder.dropIndex(connectionId, indexName, table.schema, true);
      setPendingSql(result.sql);
      setSqlPreviewOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleExecuteSql = async () => {
    try {
      await schemaBuilder.executeSql(connectionId, pendingSql);
      setSqlPreviewOpen(false);
      setPendingSql('');
      showSuccess('Operation completed successfully');
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const getPrimaryKeyColumns = () => {
    const pkConstraint = constraints.find(c => c.type === 'PRIMARY KEY');
    return pkConstraint?.columns || [];
  };

  const getForeignKeys = () => {
    return constraints.filter(c => c.type === 'FOREIGN KEY');
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Table Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {table.name}
            {table.schema !== 'public' && (
              <Chip size="small" label={table.schema} variant="outlined" />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {columns.length} columns · {constraints.length} constraints · {indexes.length} indexes
          </Typography>
        </Box>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={onUpdate}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Columns Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ColumnIcon />
            <Typography variant="h6">Columns</Typography>
            <Chip size="small" label={columns.length} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Nullable</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell>Keys</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {columns.map((col) => {
                  const isPK = getPrimaryKeyColumns().includes(col.name);
                  const fks = getForeignKeys().filter(fk => fk.columns.includes(col.name));
                  
                  return (
                    <TableRow key={col.name} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={isPK ? 600 : 400}>
                            {col.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={col.maxLength ? `${col.type}(${col.maxLength})` : col.type}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={col.nullable ? 'NULL' : 'NOT NULL'}
                          color={col.nullable ? 'default' : 'primary'}
                          variant={col.nullable ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {col.default || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {isPK && (
                            <Tooltip title="Primary Key">
                              <Chip size="small" icon={<KeyIcon />} label="PK" color="warning" />
                            </Tooltip>
                          )}
                          {fks.map((fk, i) => (
                            <Tooltip key={i} title={`FK → ${fk.foreignTable}(${fk.foreignColumns.join(', ')})`}>
                              <Chip size="small" icon={<LinkIcon />} label="FK" color="info" />
                            </Tooltip>
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEditColumn(col)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteColumn(col.name)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Button startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={handleAddColumn}>
            Add Column
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* Constraints Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon />
            <Typography variant="h6">Constraints</Typography>
            <Chip size="small" label={constraints.length} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Columns</TableCell>
                  <TableCell>References</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {constraints.map((con) => (
                  <TableRow key={con.name} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {con.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={con.type}
                        color={
                          con.type === 'PRIMARY KEY' ? 'warning' :
                          con.type === 'FOREIGN KEY' ? 'info' :
                          con.type === 'UNIQUE' ? 'secondary' : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {con.columns?.join(', ')}
                    </TableCell>
                    <TableCell>
                      {con.type === 'FOREIGN KEY' && (
                        <Typography variant="body2" color="text.secondary">
                          {con.foreignSchema !== 'public' ? `${con.foreignSchema}.` : ''}{con.foreignTable}({con.foreignColumns?.join(', ')})
                          {con.onDelete && <span> ON DELETE {con.onDelete}</span>}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteConstraint(con.name)} 
                        color="error"
                        disabled={con.type === 'PRIMARY KEY'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {constraints.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">No constraints</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Button startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setConstraintDialogOpen(true)}>
            Add Constraint
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* Indexes Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IndexIcon />
            <Typography variant="h6">Indexes</Typography>
            <Chip size="small" label={indexes.length} />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Columns</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {indexes.map((idx) => (
                  <TableRow key={idx.name} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {idx.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{idx.columns?.join(', ')}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {idx.primary && <Chip size="small" label="PRIMARY" color="warning" />}
                        {idx.unique && !idx.primary && <Chip size="small" label="UNIQUE" color="secondary" />}
                        {!idx.unique && !idx.primary && <Chip size="small" label="INDEX" variant="outlined" />}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteIndex(idx.name)} 
                        color="error"
                        disabled={idx.primary}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {indexes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary">No indexes</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Button startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setIndexDialogOpen(true)}>
            Add Index
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* Column Dialog */}
      <ColumnDialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        connectionId={connectionId}
        table={table}
        column={editingColumn}
        dataTypes={dataTypes}
        onSaved={() => {
          setColumnDialogOpen(false);
          onUpdate();
        }}
      />

      {/* Constraint Dialog */}
      <ConstraintDialog
        open={constraintDialogOpen}
        onClose={() => setConstraintDialogOpen(false)}
        connectionId={connectionId}
        table={table}
        columns={columns}
        allTables={allTables}
        onSaved={() => {
          setConstraintDialogOpen(false);
          onUpdate();
        }}
      />

      {/* Index Dialog */}
      <IndexDialog
        open={indexDialogOpen}
        onClose={() => setIndexDialogOpen(false)}
        connectionId={connectionId}
        table={table}
        columns={columns}
        onSaved={() => {
          setIndexDialogOpen(false);
          onUpdate();
        }}
      />

      {/* SQL Preview Dialog */}
      <Dialog open={sqlPreviewOpen} onClose={() => setSqlPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm SQL Execution</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will execute the following SQL. This action cannot be undone.
          </Alert>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.900', 
              color: 'grey.100',
              fontFamily: 'monospace',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {pendingSql}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSqlPreviewOpen(false)}>Cancel</Button>
          <Button onClick={handleExecuteSql} variant="contained" color="error">
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Column Dialog Component
const ColumnDialog = ({ open, onClose, connectionId, table, column, dataTypes, onSaved }) => {
  const [form, setForm] = useState({
    name: '',
    type: 'varchar',
    maxLength: 255,
    precision: '',
    scale: '',
    nullable: true,
    default: '',
    unique: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewSql, setPreviewSql] = useState('');

  useEffect(() => {
    if (column) {
      setForm({
        name: column.name,
        type: column.type,
        maxLength: column.maxLength || '',
        precision: column.precision || '',
        scale: column.scale || '',
        nullable: column.nullable,
        default: column.default || '',
        unique: false,
      });
    } else {
      setForm({
        name: '',
        type: 'varchar',
        maxLength: 255,
        precision: '',
        scale: '',
        nullable: true,
        default: '',
        unique: false,
      });
    }
    setError(null);
  }, [column, open]);

  useEffect(() => {
    const generatePreview = async () => {
      if (!form.name || !form.type) {
        setPreviewSql('');
        return;
      }
      try {
        if (column) {
          const result = await schemaBuilder.modifyColumn(connectionId, table.name, column.name, form, table.schema, true);
          setPreviewSql(result.sql || '');
        } else {
          const result = await schemaBuilder.addColumn(connectionId, table.name, form, table.schema, true);
          setPreviewSql(result.sql || '');
        }
      } catch {
        setPreviewSql('');
      }
    };
    if (open) generatePreview();
  }, [form, column, connectionId, table, open]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Column name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (column) {
        await schemaBuilder.modifyColumn(connectionId, table.name, column.name, {
          newName: form.name !== column.name ? form.name : undefined,
          type: form.type !== column.type ? form.type : undefined,
          maxLength: form.maxLength,
          precision: form.precision,
          scale: form.scale,
          nullable: form.nullable !== column.nullable ? form.nullable : undefined,
          default: form.default !== column.default ? form.default : undefined,
        }, table.schema);
      } else {
        await schemaBuilder.addColumn(connectionId, table.name, form, table.schema);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const typeInfo = dataTypes.find(t => t.name === form.type);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{column ? 'Edit Column' : 'Add Column'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Column Name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </Grid>
          <Grid item xs={typeInfo?.hasLength || typeInfo?.hasPrecision ? 6 : 12}>
            <TextField
              fullWidth
              select
              label="Data Type"
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              {dataTypes.map(t => (
                <MenuItem key={t.name} value={t.name}>
                  {t.label} ({t.name})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {typeInfo?.hasLength && (
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Length"
                value={form.maxLength}
                onChange={(e) => handleChange('maxLength', e.target.value)}
              />
            </Grid>
          )}
          {typeInfo?.hasPrecision && (
            <>
              <Grid item xs={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Precision"
                  value={form.precision}
                  onChange={(e) => handleChange('precision', e.target.value)}
                />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Scale"
                  value={form.scale}
                  onChange={(e) => handleChange('scale', e.target.value)}
                />
              </Grid>
            </>
          )}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Default Value"
              value={form.default}
              onChange={(e) => handleChange('default', e.target.value)}
              helperText="SQL expression (e.g., NULL, 0, 'text', NOW(), gen_random_uuid())"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={form.nullable} 
                  onChange={(e) => handleChange('nullable', e.target.checked)} 
                />
              }
              label="Nullable"
            />
          </Grid>
          {!column && (
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={form.unique} 
                    onChange={(e) => handleChange('unique', e.target.checked)} 
                  />
                }
                label="Unique"
              />
            </Grid>
          )}
        </Grid>

        {previewSql && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>SQL Preview</Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'grey.900', 
                color: 'grey.100',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewSql}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {column ? 'Save Changes' : 'Add Column'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Constraint Dialog Component  
const ConstraintDialog = ({ open, onClose, connectionId, table, columns, allTables, onSaved }) => {
  const [form, setForm] = useState({
    type: 'FOREIGN KEY',
    name: '',
    columns: [],
    foreignTable: '',
    foreignColumns: [],
    onUpdate: 'NO ACTION',
    onDelete: 'CASCADE',
    expression: '',
  });
  const [foreignTableColumns, setForeignTableColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewSql, setPreviewSql] = useState('');

  useEffect(() => {
    setForm({
      type: 'FOREIGN KEY',
      name: '',
      columns: [],
      foreignTable: '',
      foreignColumns: [],
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
      expression: '',
    });
    setError(null);
  }, [open]);

  useEffect(() => {
    const loadForeignColumns = async () => {
      if (form.foreignTable && connectionId) {
        const ft = allTables.find(t => t.name === form.foreignTable);
        if (ft) {
          try {
            const details = await schemaBuilder.getTableDetails(connectionId, ft.name, ft.schema);
            setForeignTableColumns(details.columns || []);
          } catch {
            setForeignTableColumns([]);
          }
        }
      } else {
        setForeignTableColumns([]);
      }
    };
    loadForeignColumns();
  }, [form.foreignTable, connectionId, allTables]);

  useEffect(() => {
    const generatePreview = async () => {
      if (!form.type || form.columns.length === 0) {
        setPreviewSql('');
        return;
      }
      try {
        const result = await schemaBuilder.addConstraint(connectionId, table.name, form, table.schema, true);
        setPreviewSql(result.sql || '');
      } catch {
        setPreviewSql('');
      }
    };
    if (open) generatePreview();
  }, [form, connectionId, table, open]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await schemaBuilder.addConstraint(connectionId, table.name, form, table.schema);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Constraint</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Constraint Type"
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              <MenuItem value="FOREIGN KEY">Foreign Key</MenuItem>
              <MenuItem value="UNIQUE">Unique</MenuItem>
              <MenuItem value="CHECK">Check</MenuItem>
            </TextField>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Constraint Name (optional)"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              helperText="Leave empty to auto-generate"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Column(s)"
              value={form.columns}
              onChange={(e) => handleChange('columns', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              SelectProps={{ multiple: true }}
            >
              {columns.map(c => (
                <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {form.type === 'FOREIGN KEY' && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="References Table"
                  value={form.foreignTable}
                  onChange={(e) => handleChange('foreignTable', e.target.value)}
                >
                  {allTables.filter(t => t.name !== table.name).map(t => (
                    <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="References Column(s)"
                  value={form.foreignColumns}
                  onChange={(e) => handleChange('foreignColumns', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                  SelectProps={{ multiple: true }}
                  disabled={!form.foreignTable}
                >
                  {foreignTableColumns.map(c => (
                    <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="ON UPDATE"
                  value={form.onUpdate}
                  onChange={(e) => handleChange('onUpdate', e.target.value)}
                >
                  <MenuItem value="NO ACTION">NO ACTION</MenuItem>
                  <MenuItem value="CASCADE">CASCADE</MenuItem>
                  <MenuItem value="SET NULL">SET NULL</MenuItem>
                  <MenuItem value="SET DEFAULT">SET DEFAULT</MenuItem>
                  <MenuItem value="RESTRICT">RESTRICT</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  select
                  label="ON DELETE"
                  value={form.onDelete}
                  onChange={(e) => handleChange('onDelete', e.target.value)}
                >
                  <MenuItem value="NO ACTION">NO ACTION</MenuItem>
                  <MenuItem value="CASCADE">CASCADE</MenuItem>
                  <MenuItem value="SET NULL">SET NULL</MenuItem>
                  <MenuItem value="SET DEFAULT">SET DEFAULT</MenuItem>
                  <MenuItem value="RESTRICT">RESTRICT</MenuItem>
                </TextField>
              </Grid>
            </>
          )}

          {form.type === 'CHECK' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Check Expression"
                value={form.expression}
                onChange={(e) => handleChange('expression', e.target.value)}
                helperText="e.g., age >= 18, status IN ('active', 'inactive')"
              />
            </Grid>
          )}
        </Grid>

        {previewSql && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>SQL Preview</Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'grey.900', 
                color: 'grey.100',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewSql}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          Add Constraint
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Index Dialog Component
const IndexDialog = ({ open, onClose, connectionId, table, columns, onSaved }) => {
  const [form, setForm] = useState({
    name: '',
    columns: [],
    unique: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewSql, setPreviewSql] = useState('');

  useEffect(() => {
    setForm({ name: '', columns: [], unique: false });
    setError(null);
  }, [open]);

  useEffect(() => {
    const generatePreview = async () => {
      if (form.columns.length === 0) {
        setPreviewSql('');
        return;
      }
      try {
        const result = await schemaBuilder.createIndex(connectionId, table.name, form, table.schema, true);
        setPreviewSql(result.sql || '');
      } catch {
        setPreviewSql('');
      }
    };
    if (open) generatePreview();
  }, [form, connectionId, table, open]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await schemaBuilder.createIndex(connectionId, table.name, form, table.schema);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Index</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Index Name (optional)"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              helperText="Leave empty to auto-generate"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              select
              label="Column(s)"
              value={form.columns}
              onChange={(e) => handleChange('columns', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              SelectProps={{ multiple: true }}
            >
              {columns.map(c => (
                <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={form.unique} 
                  onChange={(e) => handleChange('unique', e.target.checked)} 
                />
              }
              label="Unique Index"
            />
          </Grid>
        </Grid>

        {previewSql && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>SQL Preview</Typography>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'grey.900', 
                color: 'grey.100',
                fontFamily: 'monospace',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewSql}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || form.columns.length === 0}>
          Create Index
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TableDesigner;
