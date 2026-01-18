import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Alert,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Snackbar,
  useTheme,
  FormControlLabel,
  Checkbox,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Avatar,
  alpha,
  Autocomplete,
} from '@mui/material';
import {
  TableChart as TableIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  Storage as StorageIcon,
  Key as KeyIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  Save as SaveIcon,
  CreateNewFolder as CreateDbIcon,
  CheckCircle as SuccessIcon,
  OpenInNew as UseInAppIcon,
  Terminal as QueryIcon,
  PlayArrow as RunIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { saveLocalSchema, listRecords, createRecord, updateRecord, deleteRecord, importSql, getSchema } from '../../services/api';
import { saveConnection, loadConnections } from '../../utils/storage';
import { LISTENERS } from '../../_shared/listeners';

const STORAGE_KEY = 'schema_builder_databases';
const ACTIVE_DB_KEY = 'schema_builder_active_db';
const LOCAL_DATA_KEY = 'schema_builder_local_data';

// Default PostgreSQL data types
const DATA_TYPES = [
  { name: 'serial', label: 'SERIAL', category: 'numeric' },
  { name: 'bigserial', label: 'BIGSERIAL', category: 'numeric' },
  { name: 'int2', label: 'SMALLINT', category: 'numeric' },
  { name: 'int4', label: 'INTEGER', category: 'numeric' },
  { name: 'int8', label: 'BIGINT', category: 'numeric' },
  { name: 'numeric', label: 'NUMERIC', category: 'numeric', hasPrecision: true },
  { name: 'float4', label: 'REAL', category: 'numeric' },
  { name: 'float8', label: 'DOUBLE', category: 'numeric' },
  { name: 'varchar', label: 'VARCHAR', category: 'text', hasLength: true },
  { name: 'char', label: 'CHAR', category: 'text', hasLength: true },
  { name: 'text', label: 'TEXT', category: 'text' },
  { name: 'bool', label: 'BOOLEAN', category: 'boolean' },
  { name: 'date', label: 'DATE', category: 'datetime' },
  { name: 'time', label: 'TIME', category: 'datetime' },
  { name: 'timestamp', label: 'TIMESTAMP', category: 'datetime' },
  { name: 'timestamptz', label: 'TIMESTAMPTZ', category: 'datetime' },
  { name: 'uuid', label: 'UUID', category: 'other' },
  { name: 'json', label: 'JSON', category: 'other' },
  { name: 'jsonb', label: 'JSONB', category: 'other' },
  { name: 'bytea', label: 'BYTEA', category: 'other' },
];

// Helper to generate SQL from local schema
const generateCreateTableSql = (table) => {
  const lines = [];
  const constraints = [];
  
  table.columns.forEach(col => {
    let colDef = `  "${col.name}" ${col.type.toUpperCase()}`;
    if (col.maxLength) colDef += `(${col.maxLength})`;
    if (col.precision) colDef += `(${col.precision}${col.scale ? `, ${col.scale}` : ''})`;
    if (!col.nullable) colDef += ' NOT NULL';
    if (col.default) colDef += ` DEFAULT ${col.default}`;
    if (col.unique && !table.primaryKey?.includes(col.name)) colDef += ' UNIQUE';
    lines.push(colDef);
  });
  
  if (table.primaryKey?.length > 0) {
    constraints.push(`  PRIMARY KEY ("${table.primaryKey.join('", "')}")`);
  }
  
  table.foreignKeys?.forEach(fk => {
    constraints.push(`  FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}" ("${fk.refColumn}")${fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''}${fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''}`);
  });
  
  const allLines = [...lines, ...constraints];
  return `CREATE TABLE "${table.name}" (\n${allLines.join(',\n')}\n);`;
};

const generateFullSql = (tables) => {
  const sqls = [];
  
  const sorted = [...tables].sort((a, b) => {
    const aHasFk = a.foreignKeys?.some(fk => fk.refTable !== a.name);
    const bHasFk = b.foreignKeys?.some(fk => fk.refTable !== b.name);
    if (!aHasFk && bHasFk) return -1;
    if (aHasFk && !bHasFk) return 1;
    return 0;
  });
  
  sorted.forEach(table => {
    sqls.push(generateCreateTableSql(table));
    
    table.indexes?.forEach(idx => {
      const unique = idx.unique ? 'UNIQUE ' : '';
      sqls.push(`CREATE ${unique}INDEX "${idx.name}" ON "${table.name}" ("${idx.columns.join('", "')}");`);
    });
  });
  
  return sqls.join('\n\n');
};

// Generate SQL with data (schema + INSERT statements)
const generateFullSqlWithData = (tables, dbId) => {
  const sqls = [];
  
  // Add header
  sqls.push('-- Generated SQL export with data');
  sqls.push(`-- Timestamp: ${new Date().toISOString()}`);
  sqls.push('');
  
  // Add schema
  sqls.push('-- ===== SCHEMA DEFINITION =====');
  sqls.push(generateFullSql(tables));
  sqls.push('');
  
  // Load and add data
  const localData = loadLocalData(dbId);
  if (Object.keys(localData).length > 0) {
    sqls.push('-- ===== DATA =====');
    sqls.push('');
    
    // Generate INSERT statements for each table
    tables.forEach(table => {
      const rows = localData[table.name] || [];
      if (rows.length > 0) {
        sqls.push(`-- Insert data into ${table.name} (${rows.length} rows)`);
        
        rows.forEach(row => {
          const columns = table.columns.map(c => c.name);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; // Escape single quotes
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          });
          
          const insertSql = `INSERT INTO "${table.name}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`;
          sqls.push(insertSql);
        });
        
        sqls.push('');
      }
    });
  }
  
  return sqls.join('\n');
};

const loadLocalSchema = () => {
  // Load local databases from global connections storage
  // Filter for local-type connections which were created in SchemaBuilder
  const connections = loadConnections();
  console.log('[loadLocalSchema] All connections:', connections.map(c => ({ id: c.id, connectionId: c.connectionId, usedInApp: c.usedInApp, isLocal: c.isLocal })));
  const localDbs = connections
    .filter(conn => conn.isLocal || conn.type === 'local')
    .map(conn => ({
      id: conn.id,
      name: conn.name,
      tables: conn.tables || [],
      createdAt: conn.createdAt || new Date().toISOString(),
      connectionId: conn.connectionId, // Preserve for "Use in App" feature
      usedInApp: conn.usedInApp,
    }));
  console.log('[loadLocalSchema] Local DBs:', localDbs.map(db => ({ id: db.id, connectionId: db.connectionId, usedInApp: db.usedInApp })));
  return localDbs;
};

const saveAllDatabases = (databases) => {
  // Sync local databases back to global connections storage
  const connections = loadConnections();
  
  console.log('[saveAllDatabases] Saving databases:', databases.map(db => ({ id: db.id, connectionId: db.connectionId, usedInApp: db.usedInApp })));
  
  // Update or add local databases
  databases.forEach(db => {
    const targetId = db.connectionId || db.id;
    const existingIndex = connections.findIndex(c => c.id === targetId);
    const dbConnection = {
      id: targetId,
      name: db.name,
      type: 'local',
      isLocal: true,
      tables: db.tables,
      createdAt: db.createdAt,
      connectionId: db.connectionId, // Preserve connectionId for "Use in App"
      usedInApp: db.usedInApp,
    };
    
    console.log('[saveAllDatabases] Saving db:', targetId, 'with connectionId:', db.connectionId);
    
    if (existingIndex >= 0) {
      connections[existingIndex] = { ...connections[existingIndex], ...dbConnection };
    } else {
      connections.push(dbConnection);
    }
  });
  
  // Remove databases that no longer exist in SchemaBuilder
  const dbIds = new Set(databases.map(db => (db.connectionId || db.id)));
  const filtered = connections.filter(c => !c.isLocal || dbIds.has(c.id));
  
  // Save back to storage
  import('../../utils/storage').then(({ saveConnections }) => {
    saveConnections(filtered);
    // Broadcast the change
    window.dispatchEvent(new CustomEvent('connections-changed'));
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
  });
};

const getActiveDbId = () => {
  // Active database selection is managed in state only, not persisted
  return null;
};

const setActiveDbId = (id) => {
  // Active database selection is managed in state only (not persisted to localStorage)
  // This ensures fresh state on each session
};

const generateId = () => `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Local data storage functions
const loadLocalData = (dbId) => {
  try {
    const allData = JSON.parse(localStorage.getItem(LOCAL_DATA_KEY) || '{}');
    return allData[dbId] || {};
  } catch {
    return {};
  }
};

const saveLocalData = (dbId, tableData) => {
  try {
    const allData = JSON.parse(localStorage.getItem(LOCAL_DATA_KEY) || '{}');
    allData[dbId] = tableData;
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(allData));
  } catch (e) {
    console.error('Failed to save local data:', e);
  }
};

// Simple SQL parser and executor for local databases
const executeLocalQuery = (sql, tables, dbId) => {
  const trimmedSql = sql.trim();
  const upperSql = trimmedSql.toUpperCase();
  
  // Load current data
  const localData = loadLocalData(dbId);
  
  try {
    // SELECT query
    if (upperSql.startsWith('SELECT')) {
      return executeSelect(trimmedSql, tables, localData);
    }
    // INSERT query
    else if (upperSql.startsWith('INSERT')) {
      const result = executeInsert(trimmedSql, tables, localData);
      saveLocalData(dbId, localData);
      return result;
    }
    // UPDATE query
    else if (upperSql.startsWith('UPDATE')) {
      const result = executeUpdate(trimmedSql, tables, localData);
      saveLocalData(dbId, localData);
      return result;
    }
    // DELETE query
    else if (upperSql.startsWith('DELETE')) {
      const result = executeDelete(trimmedSql, tables, localData);
      saveLocalData(dbId, localData);
      return result;
    }
    // CREATE TABLE (just acknowledge, schema is managed separately)
    else if (upperSql.startsWith('CREATE TABLE')) {
      return { type: 'info', message: 'CREATE TABLE acknowledged. Use the Table Designer to create tables.' };
    }
    // DROP TABLE
    else if (upperSql.startsWith('DROP TABLE')) {
      return { type: 'info', message: 'DROP TABLE acknowledged. Use the Table Designer to manage tables.' };
    }
    else {
      throw new Error('Unsupported query type. Supported: SELECT, INSERT, UPDATE, DELETE');
    }
  } catch (error) {
    return { error: error.message };
  }
};

// Parse SELECT query
const executeSelect = (sql, tables, localData) => {
  // Enhanced SELECT parser: SELECT [DISTINCT] columns FROM table [WHERE] [GROUP BY] [HAVING] [ORDER BY] [LIMIT]
  // Also support aggregate functions COUNT, SUM, AVG, MAX, MIN and basic JOINs
  
  const selectMatch = sql.match(/SELECT\s+(?:(DISTINCT)\s+)?(.+?)\s+FROM\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+HAVING\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
  
  if (!selectMatch) {
    throw new Error('Invalid SELECT syntax. Use: SELECT [DISTINCT] cols FROM table [WHERE] [GROUP BY] [ORDER BY] [LIMIT]');
  }
  
  const [, isDistinct, columnsStr, fromClause, whereClause, groupByClause, havingClause, orderByClause, limitStr] = selectMatch;
  
  // Handle JOINs in FROM clause
  let rows = [];
  let allColumns = {};
  
  if (fromClause.toUpperCase().includes('JOIN')) {
    // Basic JOIN support
    const joinMatch = fromClause.match(/["']?(\w+)["']?\s+(?:INNER\s+)?JOIN\s+["']?(\w+)["']?\s+ON\s+(.+)/i);
    if (joinMatch) {
      const [, table1Name, table2Name, onClause] = joinMatch;
      const table1 = tables.find(t => t.name.toLowerCase() === table1Name.toLowerCase());
      const table2 = tables.find(t => t.name.toLowerCase() === table2Name.toLowerCase());
      
      if (!table1 || !table2) {
        throw new Error('Tables in JOIN not found');
      }
      
      const rows1 = localData[table1.name] || [];
      const rows2 = localData[table2.name] || [];
      
      rows1.forEach(row1 => {
        rows2.forEach(row2 => {
          if (evaluateWhere({ ...row1, ...row2 }, onClause)) {
            rows.push({ ...row1, ...row2 });
          }
        });
      });
      
      allColumns = { ...table1.columns.reduce((acc, c) => ({ ...acc, [c.name]: c }), {}),
                     ...table2.columns.reduce((acc, c) => ({ ...acc, [c.name]: c }), {}) };
    }
  } else {
    const tableName = fromClause.trim().replace(/["']/g, '');
    const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
    if (!table) {
      throw new Error(`Table "${tableName}" does not exist`);
    }
    rows = [...(localData[table.name] || [])];
    allColumns = table.columns.reduce((acc, c) => ({ ...acc, [c.name]: c }), {});
  }
  
  // Apply WHERE clause
  if (whereClause) {
    rows = rows.filter(row => evaluateWhere(row, whereClause));
  }
  
  // Parse columns
  let columns = columnsStr.split(',').map(c => c.trim());
  
  // Apply GROUP BY (basic aggregation)
  let processedRows = rows;
  
  if (groupByClause) {
    const groupCols = groupByClause.split(',').map(c => c.trim());
    const grouped = {};
    
    rows.forEach(row => {
      const key = groupCols.map(col => row[col]).join('|');
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });
    
    processedRows = Object.entries(grouped).map(([key, group]) => {
      const result = {};
      groupCols.forEach(col => {
        result[col] = group[0][col];
      });
      
      // Handle aggregate functions
      columns.forEach(col => {
        if (col.toUpperCase().includes('COUNT(')) {
          const colName = col.match(/COUNT\(\s*["']?(\*|[\w]+)["']?\s*\)/i)?.[1] || '*';
          result[col] = colName === '*' ? group.length : group.filter(r => r[colName] !== null).length;
        } else if (col.toUpperCase().includes('SUM(')) {
          const colName = col.match(/SUM\(\s*["']?([\w]+)["']?\s*\)/i)?.[1];
          result[col] = colName ? group.reduce((sum, r) => sum + (Number(r[colName]) || 0), 0) : null;
        } else if (col.toUpperCase().includes('AVG(')) {
          const colName = col.match(/AVG\(\s*["']?([\w]+)["']?\s*\)/i)?.[1];
          if (colName) {
            const sum = group.reduce((sum, r) => sum + (Number(r[colName]) || 0), 0);
            result[col] = sum / group.length;
          }
        } else if (col.toUpperCase().includes('MAX(')) {
          const colName = col.match(/MAX\(\s*["']?([\w]+)["']?\s*\)/i)?.[1];
          result[col] = colName ? Math.max(...group.map(r => Number(r[colName]) || -Infinity)) : null;
        } else if (col.toUpperCase().includes('MIN(')) {
          const colName = col.match(/MIN\(\s*["']?([\w]+)["']?\s*\)/i)?.[1];
          result[col] = colName ? Math.min(...group.map(r => Number(r[colName]) || Infinity)) : null;
        } else if (!groupCols.includes(col)) {
          result[col] = group[0][col];
        }
      });
      
      return result;
    });
  }
  
  // Apply HAVING clause
  if (havingClause) {
    processedRows = processedRows.filter(row => evaluateWhere(row, havingClause));
  }
  
  // Apply DISTINCT
  if (isDistinct) {
    const seen = new Set();
    processedRows = processedRows.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  // Apply ORDER BY
  if (orderByClause) {
    const orderCols = orderByClause.split(',').map(c => c.trim());
    processedRows.sort((a, b) => {
      for (const orderCol of orderCols) {
        const [col, dir] = orderCol.split(/\s+/);
        const direction = (dir || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
        const aVal = a[col];
        const bVal = b[col];
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
      }
      return 0;
    });
  }
  
  // Apply LIMIT
  const limit = limitStr ? parseInt(limitStr, 10) : processedRows.length;
  processedRows = processedRows.slice(0, limit);
  
  // Select columns  
  let resultColumns = columnsStr.trim() === '*' 
    ? Object.keys(allColumns)
    : columns.map(c => c.replace(/\s+AS\s+\w+/i, '').trim());
  
  // Filter columns in result
  const resultRows = processedRows.map(row => {
    const newRow = {};
    resultColumns.forEach(col => {
      const cleanCol = col.match(/(\w+)$/)?.[1] || col;
      newRow[col] = row[cleanCol] !== undefined ? row[cleanCol] : null;
    });
    return newRow;
  });
  
  return {
    type: 'select',
    rows: resultRows,
    columns: resultColumns,
    rowCount: resultRows.length,
  };
};

// Parse INSERT query
const executeInsert = (sql, tables, localData) => {
  // INSERT INTO table (columns) VALUES (values)
  const insertMatch = sql.match(/INSERT\s+INTO\s+["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  
  if (!insertMatch) {
    throw new Error('Invalid INSERT syntax. Use: INSERT INTO table (col1, col2) VALUES (val1, val2)');
  }
  
  const [, tableName, columnsStr, valuesStr] = insertMatch;
  
  const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table "${tableName}" does not exist`);
  }
  
  const columns = columnsStr.split(',').map(c => c.trim().replace(/["']/g, ''));
  const values = parseValues(valuesStr);
  
  if (columns.length !== values.length) {
    throw new Error('Column count does not match value count');
  }
  
  // Create new row
  const newRow = { _id: Date.now() };
  columns.forEach((col, i) => {
    newRow[col] = values[i];
  });
  
  // Auto-generate serial columns
  table.columns.forEach(col => {
    if ((col.type === 'serial' || col.type === 'bigserial') && newRow[col.name] === undefined) {
      const existingRows = localData[table.name] || [];
      const maxId = existingRows.reduce((max, row) => Math.max(max, row[col.name] || 0), 0);
      newRow[col.name] = maxId + 1;
    }
  });
  
  // Initialize table data if not exists
  if (!localData[table.name]) {
    localData[table.name] = [];
  }
  
  localData[table.name].push(newRow);
  
  return { type: 'insert', message: `INSERT successful - 1 row inserted`, rowCount: 1 };
};

// Parse UPDATE query  
const executeUpdate = (sql, tables, localData) => {
  // UPDATE table SET col = val [WHERE conditions]
  const updateMatch = sql.match(/UPDATE\s+["']?(\w+)["']?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
  
  if (!updateMatch) {
    throw new Error('Invalid UPDATE syntax. Use: UPDATE table SET col = val WHERE condition');
  }
  
  const [, tableName, setClause, whereClause] = updateMatch;
  
  const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table "${tableName}" does not exist`);
  }
  
  if (!localData[table.name]) {
    return { type: 'update', message: 'No rows to update', rowCount: 0 };
  }
  
  // Parse SET clause
  const updates = {};
  setClause.split(',').forEach(part => {
    const [col, val] = part.split('=').map(s => s.trim());
    updates[col.replace(/["']/g, '')] = parseValue(val);
  });
  
  let updatedCount = 0;
  localData[table.name] = localData[table.name].map(row => {
    if (!whereClause || evaluateWhere(row, whereClause)) {
      updatedCount++;
      return { ...row, ...updates };
    }
    return row;
  });
  
  return { type: 'update', message: `Updated ${updatedCount} row(s)`, rowCount: updatedCount };
};

// Parse DELETE query
const executeDelete = (sql, tables, localData) => {
  // DELETE FROM table [WHERE conditions]
  const deleteMatch = sql.match(/DELETE\s+FROM\s+["']?(\w+)["']?(?:\s+WHERE\s+(.+))?$/i);
  
  if (!deleteMatch) {
    throw new Error('Invalid DELETE syntax. Use: DELETE FROM table WHERE condition');
  }
  
  const [, tableName, whereClause] = deleteMatch;
  
  const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
  if (!table) {
    throw new Error(`Table "${tableName}" does not exist`);
  }
  
  if (!localData[table.name]) {
    return { type: 'delete', message: 'No rows to delete', rowCount: 0 };
  }
  
  const originalCount = localData[table.name].length;
  
  if (whereClause) {
    localData[table.name] = localData[table.name].filter(row => !evaluateWhere(row, whereClause));
  } else {
    localData[table.name] = [];
  }
  
  const deletedCount = originalCount - localData[table.name].length;
  
  return { type: 'delete', message: `Deleted ${deletedCount} row(s)`, rowCount: deletedCount };
};

// Helper: Apply WHERE clause to rows
const applyWhereClause = (rows, whereClause) => {
  return rows.filter(row => evaluateWhere(row, whereClause));
};

// Helper: Evaluate WHERE condition (enhanced with more operators)
const evaluateWhere = (row, whereClause) => {
  // Support: col = val, col != val, col > val, col < val, col >= val, col <= val
  // Support: IN, BETWEEN, NOT IN, LIKE, IS NULL, IS NOT NULL
  // Support AND/OR (basic)
  
  // Handle AND conditions
  if (whereClause.toUpperCase().includes(' AND ')) {
    const conditions = whereClause.split(/\s+AND\s+/i);
    return conditions.every(cond => evaluateWhere(row, cond));
  }
  
  // Handle OR conditions
  if (whereClause.toUpperCase().includes(' OR ')) {
    const conditions = whereClause.split(/\s+OR\s+/i);
    return conditions.some(cond => evaluateWhere(row, cond));
  }
  
  // Handle IN operator
  if (whereClause.toUpperCase().includes(' IN ')) {
    const inMatch = whereClause.match(/["']?(\w+)["']?\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const [, col, valuesStr] = inMatch;
      const rowVal = row[col];
      const values = valuesStr.split(',').map(v => parseValue(v.trim()));
      return values.includes(rowVal);
    }
  }
  
  // Handle NOT IN operator
  if (whereClause.toUpperCase().includes(' NOT IN ')) {
    const notInMatch = whereClause.match(/["']?(\w+)["']?\s+NOT\s+IN\s*\(([^)]+)\)/i);
    if (notInMatch) {
      const [, col, valuesStr] = notInMatch;
      const rowVal = row[col];
      const values = valuesStr.split(',').map(v => parseValue(v.trim()));
      return !values.includes(rowVal);
    }
  }
  
  // Handle BETWEEN operator
  if (whereClause.toUpperCase().includes(' BETWEEN ')) {
    const betweenMatch = whereClause.match(/["']?(\w+)["']?\s+BETWEEN\s+(.+?)\s+AND\s+(.+)/i);
    if (betweenMatch) {
      const [, col, val1Str, val2Str] = betweenMatch;
      const rowVal = row[col];
      const val1 = parseValue(val1Str);
      const val2 = parseValue(val2Str);
      return rowVal >= val1 && rowVal <= val2;
    }
  }
  
  // Single condition with standard operators
  const match = whereClause.match(/["']?(\w+)["']?\s*(=|!=|<>|>=|<=|>|<|LIKE|IS NULL|IS NOT NULL)\s*(.+)?/i);
  if (!match) return true;
  
  const [, col, operator, valStr] = match;
  const rowVal = row[col];
  const op = operator.toUpperCase();
  
  if (op === 'IS NULL') return rowVal === null || rowVal === undefined;
  if (op === 'IS NOT NULL') return rowVal !== null && rowVal !== undefined;
  
  const val = parseValue(valStr);
  
  switch (op) {
    case '=': return rowVal == val;
    case '!=':
    case '<>': return rowVal != val;
    case '>': return rowVal > val;
    case '<': return rowVal < val;
    case '>=': return rowVal >= val;
    case '<=': return rowVal <= val;
    case 'LIKE':
      const pattern = String(val).replace(/%/g, '.*').replace(/_/g, '.');
      return new RegExp(`^${pattern}$`, 'i').test(String(rowVal));
    default: return true;
  }
};

// Helper: Parse a single value
const parseValue = (val) => {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.toUpperCase() === 'NULL') return null;
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;
  if (/^['"].*['"]$/.test(trimmed)) return trimmed.slice(1, -1);
  if (!isNaN(trimmed)) return Number(trimmed);
  return trimmed;
};

// Helper: Parse multiple values from VALUES clause
const parseValues = (valuesStr) => {
  const values = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  
  for (const char of valuesStr) {
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (char === stringChar && inString) {
      inString = false;
      current += char;
    } else if (char === ',' && !inString) {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
};

const SchemaBuilder = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [databases, setDatabases] = useState(() => loadLocalSchema());
  const [activeDbId, setActiveDbIdState] = useState(() => getActiveDbId());
  const [selectedTable, setSelectedTable] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDbDialogOpen, setDeleteDbDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportWithData, setExportWithData] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [dbNameDialogOpen, setDbNameDialogOpen] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  
  const [contextMenu, setContextMenu] = useState(null);
  const [contextTable, setContextTable] = useState(null);
  const [dbContextMenu, setDbContextMenu] = useState(null);
  const [contextDb, setContextDb] = useState(null);
  
  // Query Tool state
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [sqlDialect, setSqlDialect] = useState('PostgreSQL');
  const [isImporting, setIsImporting] = useState(false);
  const isDbSelected = !!(databases.find(db => db.id === activeDbId));

  // Get current active database
  const activeDb = databases.find(db => db.id === activeDbId) || null;

  useEffect(() => {
    // Always sync to local connections storage
    saveAllDatabases(databases);

    // Skip backend schema save while running an import to avoid extra /schema calls
    if (isImporting) return;

    // Also save schema to backend for local databases when they change
    databases.forEach(db => {
      // Use connectionId if available (for API compatibility), otherwise fall back to db.id
      const connId = db.connectionId || db.id;
      if (connId) {
        // Convert to app schema format before saving
        const appSchema = db.tables && db.tables.length > 0 
          ? { tables: db.tables.map(t => ({
              name: t.name,
              columns: (t.columns || []).map(c => ({
                name: c.name,
                type: c.type,
                nullable: c.nullable !== false,
                defaultValue: c.defaultValue || null,
              })),
              primaryKeys: t.primaryKey || [],
              foreignKeys: (t.foreignKeys || []).map(fk => ({
                columnName: fk.column || fk.columnName,
                foreignTable: fk.refTable || fk.foreignTable,
                foreignColumn: fk.refColumn || fk.foreignColumn,
              })),
            }))
          }
          : { tables: [] };
        
        saveLocalSchema(connId, appSchema)
          .then(() => {
            // Broadcast schema-changed event so App context can refetch
            window.dispatchEvent(new CustomEvent('schema-changed', { detail: { connectionId: connId } }));
          })
          .catch(err => {
            console.error(`Failed to sync schema for database ${connId}:`, err);
          });
      }
    });
  }, [databases, isImporting]);

  useEffect(() => {
    setActiveDbId(activeDbId);
  }, [activeDbId]);

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const tables = activeDb?.tables || [];
  
  // DEBUG: Log tables whenever component renders
  React.useEffect(() => {
    console.log('[DEBUG RENDER] tables variable updated:', {
      tablesLength: tables.length,
      activeDbId: activeDb?.id,
      firstTablePKs: tables[0]?.primaryKey,
      allTables: tables.map(t => ({ name: t.name, pkLength: t.primaryKey?.length, hasPKField: 'primaryKey' in t })),
    });
  }, [tables]);

  const handleSelectDatabase = (db) => {
    setActiveDbIdState(db.id);
    setSelectedTable(null);
    try {
      localStorage.setItem(ACTIVE_DB_KEY, db.id);
    } catch {}
  };

  const handleCreateDatabase = (name, autoConnect = false) => {
    const dbId = generateId();
    const dbName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    // Create the proper connectionId format for API compatibility
    const connectionId = `local_${dbName}_${dbId}`;

    // Use connectionId as the database id to keep things consistent
    const newDb = {
      id: connectionId,
      name: name.trim(),
      tables: [],
      createdAt: new Date().toISOString(),
      connectionId: connectionId,
      usedInApp: autoConnect,
    };
    setDatabases(prev => [...prev, newDb]);

    // Select this new database immediately
    setActiveDbIdState(newDb.id);
    try { localStorage.setItem(ACTIVE_DB_KEY, newDb.id); } catch {}

    // Create and save a single app-compatible connection entry
    const appConnection = {
      id: connectionId,
      name: newDb.name,
      database: dbName,
      type: 'local',
      isLocal: true,
      introspectedAt: new Date().toISOString(),
      tables: [],
    };
    saveConnection(appConnection);

    // Save empty schema to backend with the proper connectionId
    saveLocalSchema(connectionId, { tables: [] })
      .then(() => {
        console.log('Schema initialized successfully for database:', connectionId);
        // Broadcast schema-changed event so App context can refetch
        window.dispatchEvent(new CustomEvent('schema-changed', { detail: { connectionId } }));
      })
      .catch(err => {
        console.error('Failed to initialize schema for new database:', connectionId, err);
        showToast(`Warning: Schema initialization failed for database "${name}". The database may not work properly.`, 'warning');
      });

    // Broadcast that connections have changed to update sidebar
    window.dispatchEvent(new CustomEvent('connections-changed'));
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));

    // Auto-connect logic: if explicitly requested or if no active connection is set yet
    const hasActiveConnection = !!localStorage.getItem('lastConnectionId');
    if (autoConnect || !hasActiveConnection) {
      // Set this database as the active connection in the app (use proper connectionId)
      localStorage.setItem('lastConnectionId', connectionId);
      window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
      // Mark this DB as used in app
      setDatabases(prev => prev.map(db => db.id === newDb.id ? { ...db, usedInApp: true } : db));
    }

    setCreateDbOpen(false);
    showToast(`Database "${name}" created${autoConnect ? ' and connected' : ''}`);
  };

  const handleDeleteDatabase = () => {
    if (!contextDb) return;
    setDatabases(prev => prev.filter(db => db.id !== contextDb.id));
    if (activeDbId === contextDb.id) {
      const remaining = databases.filter(db => db.id !== contextDb.id);
      setActiveDbIdState(remaining.length > 0 ? remaining[0].id : null);
      setSelectedTable(null);
    }
    showToast(`Database "${contextDb.name}" deleted`);
    setDeleteDbDialogOpen(false);
    setContextDb(null);
  };

  const handleRenameDatabase = () => {
    if (!newDbName.trim() || !activeDb) return;
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id ? { ...db, name: newDbName.trim() } : db
    ));
    setDbNameDialogOpen(false);
    setNewDbName('');
    showToast('Database renamed');
  };

  const handleDbContextMenu = (event, db) => {
    event.preventDefault();
    event.stopPropagation();
    setDbContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
    setContextDb(db);
  };

  const handleCloseDbContextMenu = () => {
    setDbContextMenu(null);
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setTabIndex(0);
  };

  const handleContextMenu = (event, table) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY });
    setContextTable(table);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateTable = (tableData) => {
    if (!activeDb) return;
    const newTable = {
      name: tableData.name,
      columns: tableData.columns,
      primaryKey: tableData.primaryKey,
      foreignKeys: [],
      indexes: [],
    };
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id 
        ? { ...db, tables: [...db.tables, newTable] }
        : db
    ));
    setCreateTableOpen(false);
    showToast(`Table "${tableData.name}" created`);
  };

  const handleRenameTable = () => {
    if (!contextTable || !newTableName.trim() || !activeDb) return;
    
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id 
        ? { ...db, tables: db.tables.map(t => 
            t.name === contextTable.name ? { ...t, name: newTableName } : t
          )}
        : db
    ));
    if (selectedTable?.name === contextTable.name) {
      setSelectedTable(prev => ({ ...prev, name: newTableName }));
    }
    showToast(`Table renamed to "${newTableName}"`);
    setRenameDialogOpen(false);
    setNewTableName('');
    setContextTable(null);
  };

  const handleDeleteTable = () => {
    if (!contextTable || !activeDb) return;
    
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id 
        ? { ...db, tables: db.tables.filter(t => t.name !== contextTable.name) }
        : db
    ));
    if (selectedTable?.name === contextTable.name) {
      setSelectedTable(null);
    }
    showToast(`Table "${contextTable.name}" deleted`);
    setDeleteDialogOpen(false);
    setContextTable(null);
  };

  const handleUpdateTable = (updatedTable) => {
    if (!activeDb) return;
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id 
        ? { ...db, tables: db.tables.map(t => 
            t.name === selectedTable.name ? updatedTable : t
          )}
        : db
    ));
    setSelectedTable(updatedTable);
    showToast('Table updated');
  };

  const handleExportSql = () => {
    if (!activeDb) return;
    const sql = exportWithData ? generateFullSqlWithData(activeDb.tables, activeDbId) : generateFullSql(activeDb.tables);
    navigator.clipboard.writeText(sql);
    showToast('SQL copied to clipboard');
    setExportDialogOpen(false);
  };

  const handleDownloadSql = () => {
    if (!activeDb) return;
    const sql = exportWithData ? generateFullSqlWithData(activeDb.tables, activeDbId) : generateFullSql(activeDb.tables);
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = exportWithData 
      ? `${activeDb.name.replace(/\s+/g, '_').toLowerCase()}_with_data.sql`
      : `${activeDb.name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('SQL file downloaded');
    setExportDialogOpen(false);
  };

  const handleImportSchema = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.tables && Array.isArray(imported.tables)) {
          // Import as a new database
          const newDb = {
            id: generateId(),
            name: imported.name || file.name.replace('.json', ''),
            tables: imported.tables,
            createdAt: new Date().toISOString(),
          };
          setDatabases(prev => [...prev, newDb]);
          setActiveDbIdState(newDb.id);
          showToast('Schema imported as new database');
        } else {
          showToast('Invalid schema file', 'error');
        }
      } catch {
        showToast('Failed to parse schema file', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportSchema = () => {
    if (!activeDb) return;
    const exportData = { name: activeDb.name, tables: activeDb.tables };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDb.name.replace(/\s+/g, '_').toLowerCase()}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Schema exported');
  };

  const handleClearSchema = () => {
    if (!activeDb) return;
    if (window.confirm('Are you sure you want to clear all tables? This cannot be undone.')) {
      setDatabases(prev => prev.map(db => 
        db.id === activeDb.id ? { ...db, tables: [] } : db
      ));
      setSelectedTable(null);
      showToast('All tables cleared');
    }
  };

  // Parse SQL script and extract CREATE TABLE statements
  const parseSqlScript = (sql) => {
    const tables = [];
    
    console.log('Original SQL:', sql);
    
    // Remove comments but preserve -- inside quoted strings
    // First, temporarily replace quoted strings, then remove comments, then restore
    const quotedStrings = [];
    let cleanSql = sql
      // Temporarily replace quoted strings with placeholders
      .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, (match) => {
        quotedStrings.push(match);
        return `__QUOTED_${quotedStrings.length - 1}__`;
      })
      // Now safe to remove single-line comments
      .replace(/--.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Restore quoted strings
      .replace(/__QUOTED_(\d+)__/g, (_, idx) => quotedStrings[parseInt(idx)])
      .trim();
    
    console.log('Clean SQL:', cleanSql);
    console.log('Quoted strings found:', quotedStrings);
    
    // More robust regex: match CREATE TABLE with proper handling of nested parentheses
    // Use a more careful approach to find table definitions
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(/gi;
    let match;
    
    while ((match = createTableRegex.exec(cleanSql)) !== null) {
      try {
        const tableName = match[1];
        const startIdx = match.index + match[0].length - 1; // Position of the opening (
        
        // Find matching closing parenthesis
        let parenCount = 1;
        let endIdx = startIdx + 1;
        while (endIdx < cleanSql.length && parenCount > 0) {
          if (cleanSql[endIdx] === '(') parenCount++;
          else if (cleanSql[endIdx] === ')') parenCount--;
          endIdx++;
        }
        
        if (parenCount !== 0) continue; // Unmatched parentheses, skip this table
        
        const columnsStr = cleanSql.substring(startIdx + 1, endIdx - 1);
        console.log('Raw columnsStr for table', tableName, ':', columnsStr);
        const columns = [];
        const primaryKey = [];
        const foreignKeys = [];
        
        // Smart split by comma that respects parentheses
        const columnLines = [];
        let currentLine = '';
        let depth = 0;
        for (let i = 0; i < columnsStr.length; i++) {
          const char = columnsStr[i];
          if (char === '(') {
            depth++;
            console.log(`At position ${i}: found '(', depth now ${depth}`);
          }
          else if (char === ')') {
            depth--;
            console.log(`At position ${i}: found ')', depth now ${depth}`);
          }
          
          if (char === ',' && depth === 0) {
            console.log(`At position ${i}: found comma at depth 0, splitting. Current line: "${currentLine.trim()}"`);
            // Normalize whitespace: collapse newlines and multiple spaces into single space
            const normalized = currentLine.trim().replace(/\s+/g, ' ');
            if (normalized) columnLines.push(normalized);
            currentLine = '';
          } else {
            currentLine += char;
          }
        }
        // Normalize the last line too
        const normalized = currentLine.trim().replace(/\s+/g, ' ');
        if (normalized) columnLines.push(normalized);
        
        console.log('Parsed columnLines for table', tableName, ':', columnLines);
        
        columnLines.forEach(line => {
          if (line.toUpperCase().startsWith('PRIMARY KEY')) {
            const pkMatch = line.match(/PRIMARY\s+KEY\s*\((.*?)\)/i);
            if (pkMatch) {
              pkMatch[1].split(',').forEach(col => {
                const colName = col.trim().replace(/["']/g, '');
                if (colName) primaryKey.push(colName);
              });
            }
          } else if (line.toUpperCase().startsWith('FOREIGN KEY') || line.toUpperCase().startsWith('CONSTRAINT')) {
            const fkMatch = line.match(/FOREIGN\s+KEY\s*\((.*?)\)\s*REFERENCES\s+(["']?\w+["']?)\s*\((.*?)\)/i);
            if (fkMatch) {
              const fkColumn = fkMatch[1].trim().replace(/["']/g, '');
              const refTable = fkMatch[2].replace(/["']/g, '');
              const refColumn = fkMatch[3].trim().replace(/["']/g, '');
              
              // Check if this FK already exists
              if (!foreignKeys.some(fk => fk.column === fkColumn && fk.refTable === refTable)) {
                foreignKeys.push({
                  column: fkColumn,
                  refTable: refTable,
                  refColumn: refColumn,
                });
              }
            }
          } else if (line && !line.toUpperCase().startsWith('CONSTRAINT') && !line.toUpperCase().startsWith('UNIQUE') && !line.toUpperCase().startsWith('INDEX')) {
            // Parse individual column - match any column name (quoted or unquoted) followed by type
            console.log('Attempting to parse as column:', line);
            const colMatch = line.match(/("[^"]+"|'[^']+'|`[^`]+`|\w+)\s+(\w+)(?:\((.*?)\))?\s*(.*)?/i);
            console.log('Column line:', line, 'Match:', colMatch);
            if (colMatch) {
              // Get the column name and remove quotes
              let colName = colMatch[1].trim();
              colName = colName.replace(/^["'`]|["'`]$/g, ''); // Remove surrounding quotes
              const colType = colMatch[2];
              const colParams = colMatch[3];
              const colConstraints = (colMatch[4] || '').toUpperCase();
              console.log('Parsed column:', { colName, colType, colParams, colConstraints });
              
              columns.push({
                name: colName,
                type: colType.toLowerCase(),
                nullable: !colConstraints.includes('NOT NULL'),
                default: null,
                unique: colConstraints.includes('UNIQUE'),
              });
              
              if (colConstraints.includes('PRIMARY KEY')) {
                primaryKey.push(colName);
              }
              
              // Check for inline REFERENCES (e.g., user_id INT REFERENCES users(id))
              const inlineRefMatch = line.match(/REFERENCES\s+(["']?\w+["']?)\s*\((.*?)\)/i);
              if (inlineRefMatch) {
                const refTable = inlineRefMatch[1].replace(/["']/g, '');
                const refColumn = inlineRefMatch[2].trim().replace(/["']/g, '');
                
                if (!foreignKeys.some(fk => fk.column === colName && fk.refTable === refTable)) {
                  foreignKeys.push({
                    column: colName,
                    refTable: refTable,
                    refColumn: refColumn,
                  });
                }
              }
            }
          }
        });
        
        if (columns.length > 0) {
          // Mark columns that are foreign keys
          columns.forEach(col => {
            const fk = foreignKeys.find(fk => fk.column === col.name);
            if (fk) {
              col.isForeignKey = true;
              col.foreignKeyRef = fk;
            }
          });
          
          tables.push({
            name: tableName,
            columns,
            primaryKey,
            foreignKeys,
            indexes: [],
          });
        }
      } catch (err) {
        console.error('Error parsing table:', err);
      }
    }
    
    return tables;
  };

  // Handle uploading SQL script
  const handleUploadScript = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !activeDb) {
      showToast('Please select a database first', 'warning');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const sql = e.target?.result;
        if (typeof sql !== 'string') {
          showToast('Invalid file content', 'error');
          return;
        }
        
        setIsImporting(true);
        // Prefer backend import when we have a connection identifier (connectionId or id)
        const connId = activeDb.connectionId || activeDb.id;
        if (connId) {
          try {
            const result = await importSql(connId, sql, sqlDialect || 'PostgreSQL');
            showToast(`Imported ${result.tables} table(s), inserted ${result.totalRows} row(s)`, 'success');
            // Refresh schema from backend and reflect in builder state
            const backendSchema = await getSchema(connId).catch(() => null);
            console.log('[DEBUG POST IMPORT] backendSchema received:', {
              type: typeof backendSchema,
              keys: backendSchema ? Object.keys(backendSchema) : null,
              firstTableRaw: backendSchema ? Object.values(backendSchema)[0] : null,
            });
            if (backendSchema && typeof backendSchema === 'object') {
              const newTables = Object.entries(backendSchema).map(([name, t]) => ({
                name,
                columns: t.columns || [],
                primaryKey: t.primaryKeys || [],
                foreignKeys: (t.foreignKeys || []).map(fk => ({ column: fk.columnName, refTable: fk.foreignTable, refColumn: fk.foreignColumn })),
                indexes: t.indexes || [],
              }));
              console.log('[DEBUG POST IMPORT] newTables to set:', {
                count: newTables.length,
                firstTable: newTables[0],
              });
              setDatabases(prev => {
                const updated = prev.map(db => db.id === activeDb.id ? { ...db, tables: newTables } : db);
                console.log('[DEBUG POST IMPORT] Updated databases:', {
                  dbCount: updated.length,
                  targetDbId: activeDb.id,
                  foundDb: updated.find(d => d.id === activeDb.id),
                });
                return updated;
              });
              
              // Save the updated schema with primaryKeys to backend via POST /schema
              const appSchema = convertToAppSchema(newTables);
              console.log('[DEBUG POST IMPORT] About to save appSchema:', {
                tableCount: Object.keys(appSchema).length,
                firstTablePKs: appSchema[Object.keys(appSchema)[0]]?.primaryKeys,
                appSchemaKeys: Object.keys(appSchema),
                appSchemaFull: appSchema,
              });
              await saveLocalSchema(connId, appSchema);
              console.log('[DEBUG POST IMPORT] saveLocalSchema completed');
            }
            event.target.value = '';
            // Ensure this connection is active in the app so data shows up in Schema UI
            localStorage.setItem('lastConnectionId', connId);
            window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
            window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
            // Ensure a connection entry exists; if missing, create one now
            try {
              const existing = loadConnections();
              const has = existing.some(c => c.id === connId);
              if (!has) {
                const dbName = (activeDb?.name || connId).toLowerCase().replace(/[^a-z0-9_]/g, '_');
                saveConnection({ id: connId, name: activeDb?.name || dbName, database: dbName, type: 'local', isLocal: true, introspectedAt: new Date().toISOString() });
              }
            } catch {}
            // Notify schema listeners to refetch
            window.dispatchEvent(new CustomEvent('schema-changed', { detail: { connectionId: connId } }));
            setDatabases(prev => prev.map(db => db.id === activeDb.id ? { ...db, usedInApp: true } : db));
            setIsImporting(false);
            return; // Done via backend path
          } catch (be) {
            console.warn('Backend SQL import failed, falling back to client parser:', be?.message || be);
          }
        }

        console.log('Parsing SQL script...');
        const parsedTables = parseSqlScript(sql);
        console.log(`Parsed ${parsedTables.length} tables:`, parsedTables.map(t => t.name));
        
        if (parsedTables.length === 0) {
          showToast('No valid CREATE TABLE statements found in script', 'warning');
          return;
        }
        
        // Add parsed tables to current database
        let newTablesAdded = 0;
        let combinedTables = tables;
        setDatabases(prev => prev.map(db => {
          if (db.id === activeDb.id) {
            const existingTableNames = new Set((db.tables || []).map(t => t.name));
            const newTables = parsedTables.filter(t => !existingTableNames.has(t.name));
            newTablesAdded = newTables.length;
            combinedTables = [...(db.tables || []), ...newTables];
            console.log(`Adding ${newTables.length} new tables (${newTables.map(t => t.name).join(', ')})`);
            return {
              ...db,
              tables: combinedTables,
            };
          }
          return db;
        }));

        // Execute INSERT statements in the SQL against local data
        const dbIdForData = activeDb.id;
        const statements = String(sql).split(';').map(s => s.trim()).filter(Boolean);
        let insertCount = 0;
        const singleInserts = [];
        for (const stmt of statements) {
          if (/^INSERT\s+INTO\s+/i.test(stmt)) {
            // Normalize multi-row INSERT INTO ... VALUES (...),(...),(...)
            const m = stmt.match(/^(INSERT\s+INTO\s+["']?\w+["']?(?:\s*\([^)]*\))?\s*VALUES\s*)([\s\S]+)$/i);
            if (m) {
              const prefix = m[1];
              const valuesPart = m[2];
              // Split values groups respecting quotes and parentheses
              const groups = [];
              let cur = '';
              let depth = 0;
              let inStr = false;
              let strCh = '';
              for (let i = 0; i < valuesPart.length; i++) {
                const ch = valuesPart[i];
                if ((ch === '"' || ch === "'") && !inStr) { inStr = true; strCh = ch; cur += ch; continue; }
                if (inStr) { cur += ch; if (ch === strCh) { inStr = false; } continue; }
                if (ch === '(') { depth++; cur += ch; continue; }
                if (ch === ')') { depth--; cur += ch; if (depth === 0) { groups.push(cur.trim()); cur = ''; }
                  continue; }
                if (ch === ',' && depth === 0) { /* separator between groups */ continue; }
                cur += ch;
              }
              for (const g of groups) {
                singleInserts.push(`${prefix}${g}`);
              }
            } else {
              singleInserts.push(stmt);
            }
          }
        }

        const connectionId = activeDb.connectionId || activeDb.id;
        if (connectionId) {
          const insertPromises = [];
          // Route inserts to backend for app-connected local DBs
          for (const stmt of singleInserts) {
            try {
              const mm = stmt.match(/^INSERT\s+INTO\s+["']?(\w+)["']?\s*(?:\(([^)]*)\))?\s*VALUES\s*\(([\s\S]*)\)$/i);
              if (!mm) {
                // Fallback to local executor if parsing fails
                const res = executeLocalQuery(stmt, combinedTables, dbIdForData);
                if (res && res.type === 'insert') insertCount += (res.rowCount || 1);
                continue;
              }
              const tableName = mm[1];
              const colsRaw = mm[2];
              let cols = [];
              if (colsRaw && colsRaw.trim().length) {
                cols = colsRaw.split(',').map(c => c.trim().replace(/^\"|^'|\"$|'$/g, ''));
              } else {
                const t = combinedTables.find(t => t.name === tableName);
                if (!t || !t.columns || t.columns.length === 0) {
                  // No schema info; fallback to local executor
                  const res = executeLocalQuery(stmt, combinedTables, dbIdForData);
                  if (res && res.type === 'insert') insertCount += (res.rowCount || 1);
                  continue;
                }
                cols = t.columns.map(c => c.name);
              }
              const rawValues = mm[3];
              // Split values by commas respecting quotes
              const values = [];
              let buf = '';
              let inStr = false; let strCh = '';
              for (let i = 0; i < rawValues.length; i++) {
                const ch = rawValues[i];
                if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strCh = ch; buf += ch; continue; }
                if (inStr) { buf += ch; if (ch === strCh) { inStr = false; } continue; }
                if (ch === ',') { values.push(buf.trim()); buf = ''; continue; }
                buf += ch;
              }
              if (buf.trim().length) values.push(buf.trim());
              const parseToken = (t) => {
                const s = t.trim();
                if (/^NULL$/i.test(s)) return null;
                if (/^(TRUE|FALSE)$/i.test(s)) return /^TRUE$/i.test(s);
                if (/^['"][\s\S]*['"]$/.test(s)) return s.slice(1, -1);
                if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
                return s;
              };
              const row = {};
              cols.forEach((c, idx) => { row[c] = parseToken(values[idx] ?? null); });
              insertPromises.push(
                createRecord(connectionId, tableName, row)
                  .then(() => { insertCount += 1; })
                  .catch(e => console.warn('Backend insert failed:', e?.message || e))
              );
            } catch (e) {
              console.warn('Backend insert failed:', e?.message || e);
            }
          }
          Promise.all(insertPromises)
            .then(() => showToast(`Imported ${newTablesAdded} table(s) and inserted ${insertCount} row(s)`, 'success'))
            .catch(() => showToast(`Imported ${newTablesAdded} table(s); some inserts failed`, 'warning'))
            .finally(() => setIsImporting(false));
        } else {
          // Fall back to local-only execution
          for (const ins of singleInserts) {
            try {
              const res = executeLocalQuery(ins, combinedTables, dbIdForData);
              if (res && res.type === 'insert') insertCount += (res.rowCount || 1);
            } catch (e) {
              console.warn('Insert execution failed:', e?.message || e);
            }
          }
          showToast(`Imported ${newTablesAdded} table(s) and inserted ${insertCount} row(s)`, 'success');
          setIsImporting(false);
        }
      } catch (err) {
        console.error('Error uploading script:', err);
        showToast(`Error parsing SQL script: ${err.message}`, 'error');
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Convert local schema to the format used by the rest of the app
  const convertToAppSchema = (localTables) => {
    console.log('[DEBUG convertToAppSchema] Input tables:', {
      count: localTables.length,
      firstTableFull: localTables[0],
      allTables: localTables.map(t => ({
        name: t.name,
        hasPrimaryKey: 'primaryKey' in t,
        primaryKeyValue: t.primaryKey,
        primaryKeyType: typeof t.primaryKey,
        columns: t.columns?.map(c => c.name),
      })),
    });
    
    const schema = {};
    
    localTables.forEach(table => {
      schema[table.name] = {
        name: table.name,
        schema: 'public',
        columns: (table.columns || []).map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable !== false,
          default: col.default || null,
          maxLength: col.maxLength || null,
          precision: col.precision || null,
          scale: col.scale || null,
          isPrimaryKey: (table.primaryKey || []).includes(col.name),
          isUnique: col.unique || false,
        })),
        primaryKeys: table.primaryKey || [],
        foreignKeys: (table.foreignKeys || []).map(fk => ({
          columnName: fk.column,
          foreignTable: fk.refTable,
          foreignColumn: fk.refColumn,
          onDelete: fk.onDelete || 'NO ACTION',
          onUpdate: fk.onUpdate || 'NO ACTION',
        })),
        indexes: (table.indexes || []).map(idx => ({
          name: idx.name,
          columns: idx.columns,
          isUnique: idx.unique || false,
        })),
      };
    });
    
    console.log('[DEBUG convertToAppSchema] Output schema:', {
      tableNames: Object.keys(schema),
      firstTableFull: schema[localTables[0]?.name],
    });
    
    return schema;
  };

  // Use this database in the rest of the app (Schema, ER Diagram, APIs, etc.)
  const handleUseInApp = () => {
    console.log('[DEBUG handleUseInApp] CALLED with:', {
      activeDbId: activeDbId,
      activeDbIdState: activeDbIdState,
      activeDatabaseObject: activeDb,
      tablesLength: tables.length,
      tablesFirst: tables[0],
    });
    
    if (!activeDb || tables.length === 0) {
      showToast('Create at least one table first', 'warning');
      return;
    }
    
    console.log('[DEBUG handleUseInApp] activeDb.tables:', {
      count: activeDb.tables?.length,
      firstTablePKs: activeDb.tables?.[0]?.primaryKey,
      tables: tables.map(t => ({ name: t.name, pkLength: t.primaryKey?.length })),
    });
    
    const dbName = activeDb.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    // Use existing connectionId if already set (from auto-connect), otherwise create new one
    const connectionId = activeDb.connectionId || `local_${dbName}_${activeDb.id}`;
    
    // Convert local schema to app schema format
    const appSchema = convertToAppSchema(tables);
    
    // Save the schema so getSchema() can find it
    saveLocalSchema(connectionId, appSchema);
    
    // Create a "virtual" connection entry (only if not already exists)
    if (!activeDb.connectionId) {
      const connection = {
        id: connectionId,
        name: activeDb.name,
        database: dbName,
        type: 'local',
        isLocal: true,
        introspectedAt: new Date().toISOString(),
      };
      
      saveConnection(connection);
    }
    
    // Set as current connection and notify other components
    localStorage.setItem('lastConnectionId', connectionId);
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
    
    // Update the local database with connection info
    setDatabases(prev => prev.map(db => 
      db.id === activeDb.id ? { ...db, connectionId, usedInApp: true } : db
    ));
    
    showToast(`"${activeDb.name}" is now available in the app! Redirecting...`, 'success');
    
    // Navigate to Schema page
    setTimeout(() => {
      navigate('/schema');
    }, 1000);
  };

  // No databases - show welcome screen
  if (databases.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: 'calc(100vh - 64px)',
        p: 3,
      }}>
        <StorageIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
        <Typography variant="h4" gutterBottom>
          Schema Builder
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center', maxWidth: 500 }}>
          Design your PostgreSQL database schema locally. Create tables, columns, relationships, indexes and export as SQL.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<CreateDbIcon />}
          onClick={() => setCreateDbOpen(true)}
        >
          Create Your First Database
        </Button>

        <CreateDatabaseDialog
          open={createDbOpen}
          onClose={() => setCreateDbOpen(false)}
          onCreated={handleCreateDatabase}
          existingNames={databases.map(db => db.name)}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Databases Sidebar */}
      <Paper 
        elevation={0} 
        sx={{ 
          width: 220, 
          borderRight: 1, 
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Databases
            </Typography>
            <Tooltip title="Create Database">
              <IconButton size="small" color="primary" onClick={() => setCreateDbOpen(true)}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {databases.map((db) => (
            <ListItem
              key={db.id}
              button
              selected={activeDbId === db.id}
              onClick={() => handleSelectDatabase(db)}
              onContextMenu={(e) => handleDbContextMenu(e, db)}
              sx={{ 
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: activeDbId === db.id ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    bgcolor: activeDbId === db.id ? 'primary.main' : alpha(theme.palette.primary.main, 0.1),
                    color: activeDbId === db.id ? 'white' : 'primary.main',
                  }}
                >
                  <StorageIcon fontSize="small" />
                </Avatar>
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {db.name}
                    {db.usedInApp && (
                      <Tooltip title="Available in app (Schema, ER, APIs)">
                        <SuccessIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      </Tooltip>
                    )}
                  </Box>
                }
                secondary={`${db.tables?.length || 0} tables`}
                primaryTypographyProps={{ 
                  variant: 'body2',
                  noWrap: true,
                  fontWeight: activeDbId === db.id ? 600 : 400,
                }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Tooltip title={isDbSelected ? 'Import Schema (JSON)' : 'Select a database first'}>
            <span>
              <Button size="small" fullWidth component="label" startIcon={<UploadIcon />} variant="outlined" disabled={!isDbSelected}>
                Import Schema
                <input type="file" hidden accept=".json" onChange={handleImportSchema} />
              </Button>
            </span>
          </Tooltip>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Tooltip title={isDbSelected ? 'Upload SQL Script (.sql)' : 'Select a database first'}>
              <span style={{ flex: 1 }}>
                <Button size="small" component="label" startIcon={<CodeIcon />} variant="outlined" sx={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }} disabled={!isDbSelected}>
                  Upload SQL
                  <input type="file" hidden accept=".sql,.txt" onChange={handleUploadScript} />
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={isDbSelected ? 'Select SQL dialect' : 'Select a database first'}>
              <span>
                <FormControl size="small" sx={{ minWidth: 140, flex: '0 0 140px' }} disabled={!isDbSelected}>
                  <InputLabel id="sql-dialect-label">Dialect</InputLabel>
                  <Select
                    labelId="sql-dialect-label"
                    label="Dialect"
                    value={sqlDialect}
                    onChange={(e) => setSqlDialect(e.target.value)}
                  >
                    <MenuItem value="PostgreSQL">PostgreSQL</MenuItem>
                    <MenuItem value="MySQL">MySQL</MenuItem>
                  </Select>
                </FormControl>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Tables Sidebar */}
      <Paper 
        elevation={0} 
        sx={{ 
          width: 260, 
          borderRight: 1, 
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TableIcon fontSize="small" />
              Tables
            </Typography>
            <Tooltip title="New Table">
              <IconButton size="small" color="primary" onClick={() => setCreateTableOpen(true)} disabled={!activeDb}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {activeDb && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => {
                  setNewDbName(activeDb.name);
                  setDbNameDialogOpen(true);
                }}
              >
                {activeDb.name}
              </Typography>
              <Chip label="Local" size="small" color="info" sx={{ height: 18, fontSize: 10 }} />
            </Box>
          )}
        </Box>

        {/* Toolbar */}
        {activeDb && (
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Tooltip title="Export SQL">
              <IconButton size="small" onClick={() => setExportDialogOpen(true)} disabled={tables.length === 0}>
                <CodeIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Schema (JSON)">
              <IconButton size="small" onClick={handleExportSchema} disabled={tables.length === 0}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {!activeDb ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Select a database
              </Typography>
            </Box>
          ) : tables.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <TableIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No tables yet
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setCreateTableOpen(true)}
                sx={{ mt: 1 }}
              >
                Create First Table
              </Button>
            </Box>
          ) : (
            tables.map((table) => (
              <ListItem
                key={table.name}
                button
                selected={selectedTable?.name === table.name}
                onClick={() => handleTableSelect(table)}
                onContextMenu={(e) => handleContextMenu(e, table)}
                sx={{ 
                  py: 1,
                  '&:hover .table-actions': { opacity: 1 },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <TableIcon fontSize="small" color={selectedTable?.name === table.name ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText 
                  primary={table.name}
                  secondary={`${table.columns?.length || 0} columns`}
                  primaryTypographyProps={{ 
                    variant: 'body2',
                    noWrap: true,
                    fontWeight: selectedTable?.name === table.name ? 600 : 400,
                  }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <ListItemSecondaryAction className="table-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                  <IconButton 
                    size="small" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, table);
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>

        {activeDb && tables.length > 0 && (
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button 
              size="small" 
              variant="contained" 
              color="primary" 
              fullWidth 
              startIcon={activeDb?.usedInApp ? <SuccessIcon /> : <UseInAppIcon />}
              onClick={handleUseInApp}
              disabled={activeDb?.usedInApp}
            >
              {activeDb?.usedInApp ? 'Using in App' : 'Use in App'}
            </Button>
            <Button size="small" color="error" fullWidth onClick={handleClearSchema}>
              Clear All Tables
            </Button>
          </Box>
        )}
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs 
            value={tabIndex} 
            onChange={(e, v) => setTabIndex(v)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Schema" icon={<TableIcon />} iconPosition="start" />
            <Tab label="SQL Preview" icon={<CodeIcon />} iconPosition="start" />
            <Tab label="Query Tool" icon={<QueryIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {tabIndex === 0 ? (
            selectedTable ? (
              <LocalTableDesigner
                table={selectedTable}
                allTables={tables}
                onUpdate={handleUpdateTable}
                activeDb={activeDb}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <TableIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {!activeDb ? 'Select a database first' : tables.length === 0 ? 'Create your first table to get started' : 'Select a table to edit'}
                </Typography>
                {activeDb && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateTableOpen(true)}
                    sx={{ mt: 2 }}
                  >
                    Create New Table
                  </Button>
                )}
              </Box>
            )
          ) : tabIndex === 1 ? (
            <SqlPreview tables={tables} dbName={activeDb?.name || 'Database'} />
          ) : (
            <QueryToolPanel 
              tables={tables}
              activeDbId={activeDbId}
              queryText={queryText}
              setQueryText={setQueryText}
              queryResult={queryResult}
              queryError={queryError}
              onExecute={() => {
                if (!queryText.trim()) {
                  setQueryError('Please enter a SQL query');
                  setQueryResult(null);
                  return;
                }
                try {
                  const result = executeLocalQuery(queryText, tables, activeDbId);
                  setQueryResult(result);
                  setQueryError(null);
                } catch (error) {
                  setQueryError(error.message);
                  setQueryResult(null);
                }
              }}
            />
          )}
        </Box>
      </Box>

      {/* Database Context Menu */}
      <Menu
        open={dbContextMenu !== null}
        onClose={handleCloseDbContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          dbContextMenu !== null
            ? { top: dbContextMenu.mouseY, left: dbContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => {
          if (contextDb) {
            setActiveDbIdState(contextDb.id);
            setNewDbName(contextDb.name);
            setDbNameDialogOpen(true);
          }
          handleCloseDbContextMenu();
        }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Rename Database
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDbDialogOpen(true);
          handleCloseDbContextMenu();
        }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete Database
        </MenuItem>
      </Menu>

      {/* Table Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => {
          setNewTableName(contextTable?.name || '');
          setRenameDialogOpen(true);
          handleCloseContextMenu();
        }}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          Rename Table
        </MenuItem>
        <MenuItem onClick={() => {
          setDeleteDialogOpen(true);
          handleCloseContextMenu();
        }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Delete Table
        </MenuItem>
      </Menu>

      {/* Create Table Dialog */}
      <CreateTableDialog
        open={createTableOpen}
        onClose={() => setCreateTableOpen(false)}
        onCreated={handleCreateTable}
        existingTables={tables}
      />

      {/* Create Database Dialog */}
      <CreateDatabaseDialog
        open={createDbOpen}
        onClose={() => setCreateDbOpen(false)}
        onCreated={handleCreateDatabase}
        existingNames={databases.map(db => db.name)}
      />

      {/* Delete Database Confirmation Dialog */}
      <Dialog open={deleteDbDialogOpen} onClose={() => setDeleteDbDialogOpen(false)}>
        <DialogTitle>Delete Database</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete the database <strong>{contextDb?.name}</strong>?
            All tables will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDbDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteDatabase} variant="contained" color="error">
            Delete Database
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Table Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Table</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New Table Name"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameTable} variant="contained">Rename</Button>
        </DialogActions>
      </Dialog>

      {/* Rename Database Dialog */}
      <Dialog open={dbNameDialogOpen} onClose={() => setDbNameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Database</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Database Name"
            value={newDbName}
            onChange={(e) => setNewDbName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDbNameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRenameDatabase} variant="contained">Rename</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Table</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone!
          </Alert>
          <Typography>
            Are you sure you want to delete the table <strong>{contextTable?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteTable} variant="contained" color="error">
            Delete Table
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export SQL Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Export SQL</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={exportWithData}
                onChange={(e) => setExportWithData(e.target.checked)}
              />
            }
            label="Include data (INSERT statements)"
            sx={{ mb: 2, display: 'block' }}
          />
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.900',
              color: 'grey.100',
              fontFamily: 'monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: 400,
            }}
          >
            {exportWithData ? generateFullSqlWithData(tables, activeDbId) : generateFullSql(tables)}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Close</Button>
          <Button onClick={handleExportSql} startIcon={<CopyIcon />}>
            Copy to Clipboard
          </Button>
          <Button onClick={handleDownloadSql} variant="contained" startIcon={<DownloadIcon />}>
            Download .sql
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Query Tool Panel Component
const QueryToolPanel = ({ tables, activeDbId, queryText, setQueryText, queryResult, queryError, onExecute }) => {
  const theme = useTheme();
  
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Query Input Section */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Query Editor</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 1 }}>
              Press Ctrl+Enter to run
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<RunIcon />}
              onClick={onExecute}
              disabled={!queryText.trim() || !activeDbId}
            >
              Run Query
            </Button>
          </Box>
        </Box>
        <TextField
          multiline
          rows={6}
          fullWidth
          placeholder={`-- SQL Query Editor
-- SELECT: columns, DISTINCT, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, JOINs, aggregates (COUNT, SUM, AVG, MAX, MIN)
-- INSERT, UPDATE, DELETE: full DML support
-- WHERE: =, !=, <>, >, <, >=, <=, LIKE, IN, NOT IN, BETWEEN, IS NULL, AND, OR

SELECT DISTINCT name, COUNT(*) as count FROM users WHERE status = 'active' GROUP BY name HAVING count > 1 ORDER BY count DESC;
SELECT u.*, o.id FROM users u JOIN orders o ON u.id = o.user_id WHERE o.total BETWEEN 100 AND 1000;
INSERT INTO users (name, email) VALUES ('John', 'john@example.com');
UPDATE users SET status = 'inactive' WHERE id IN (1, 2, 3);
DELETE FROM users WHERE created_at < NOW();`}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: 14,
            },
          }}
        />
      </Paper>

      {/* Available Tables */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Available Tables</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {tables.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tables available. Create tables in the Table Designer first.
            </Typography>
          ) : (
            tables.map(t => (
              <Chip 
                key={t.name} 
                label={t.name}
                size="small"
                onClick={() => setQueryText(prev => prev + (prev ? '\n' : '') + `SELECT * FROM ${t.name};`)}
                sx={{ cursor: 'pointer' }}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Results Section */}
      <Paper variant="outlined" sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        <Typography variant="h6" gutterBottom>Results</Typography>
        
        {queryError && (
          <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
            {queryError}
          </Alert>
        )}

        {queryResult && (
          <Box>
            {queryResult.type === 'select' ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {queryResult.rows.length} row(s) returned
                </Typography>
                {queryResult.rows.length > 0 ? (
                  <Box sx={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>
                          {queryResult.columns.map(col => (
                            <th key={col} style={{ 
                              padding: '8px 12px', 
                              textAlign: 'left', 
                              borderBottom: `1px solid ${theme.palette.divider}`,
                              fontWeight: 600,
                            }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, rowIdx) => (
                          <tr key={rowIdx} style={{ 
                            backgroundColor: rowIdx % 2 === 0 ? 'transparent' : (theme.palette.mode === 'dark' ? '#2a2a2a' : '#fafafa')
                          }}>
                            {queryResult.columns.map(col => (
                              <td key={col} style={{ 
                                padding: '8px 12px', 
                                borderBottom: `1px solid ${theme.palette.divider}`,
                              }}>
                                {row[col] === null ? (
                                  <span style={{ color: theme.palette.text.disabled, fontStyle: 'italic' }}>NULL</span>
                                ) : typeof row[col] === 'boolean' ? (
                                  row[col] ? 'true' : 'false'
                                ) : typeof row[col] === 'object' ? (
                                  JSON.stringify(row[col])
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                ) : (
                  <Alert severity="info">No rows returned</Alert>
                )}
              </>
            ) : (
              <Alert severity="success">
                {queryResult.message}
              </Alert>
            )}
          </Box>
        )}

        {!queryResult && !queryError && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 4,
            color: 'text.secondary'
          }}>
            <QueryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body1">Run a query to see results</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// SQL Preview Component
const SqlPreview = ({ tables, dbName }) => {
  const sql = generateFullSql(tables);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">SQL Preview - {dbName}</Typography>
        <Button startIcon={<CopyIcon />} onClick={handleCopy} disabled={!sql}>
          Copy SQL
        </Button>
      </Box>
      
      {tables.length === 0 ? (
        <Alert severity="info">
          Create some tables to see the SQL preview.
        </Alert>
      ) : (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            bgcolor: 'grey.900',
            color: 'grey.100',
            fontFamily: 'monospace',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
            overflow: 'auto',
            minHeight: 300,
          }}
        >
          {sql}
        </Paper>
      )}
    </Box>
  );
};

// Local Table Designer Component
const LocalTableDesigner = ({ table, allTables, onUpdate, activeDb }) => {
  const theme = useTheme();
  const [columns, setColumns] = useState(table.columns || []);
  const [primaryKey, setPrimaryKey] = useState(table.primaryKey || []);
  const [foreignKeys, setForeignKeys] = useState(table.foreignKeys || []);
  const [indexes, setIndexes] = useState(table.indexes || []);
  
  // Pagination state for Data section
  const [dataLimit, setDataLimit] = useState(25);
  const [dataOffset, setDataOffset] = useState(0);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [addFkOpen, setAddFkOpen] = useState(false);
  const [addIndexOpen, setAddIndexOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  
  // Data management state
  const [tableData, setTableData] = useState([]);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [editRowOpen, setEditRowOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [newRowData, setNewRowData] = useState({});
  const [dataLoading, setDataLoading] = useState(false);

  // Function to load data - prefers backend API if connectionId exists
  const loadTableData = async () => {
    const connectionId = activeDb?.connectionId || activeDb?.id;
    
    console.log('[SchemaBuilder] loadTableData - activeDb:', activeDb?.id, 'connectionId:', connectionId, 'table:', table.name);
    
    if (connectionId) {
      // Database has been "used in app" - fetch from backend
      setDataLoading(true);
      try {
        console.log('[SchemaBuilder] Fetching from backend:', connectionId, table.name);
        const rows = await listRecords(connectionId, table.name, { limit: dataLimit, offset: dataOffset });
        console.log('[SchemaBuilder] Backend returned rows:', rows?.length);
        setTableData(Array.isArray(rows) ? rows : []);
        
        // Also update localStorage to keep it in sync
        const dbId = localStorage.getItem(ACTIVE_DB_KEY);
        if (dbId) {
          const currentData = loadLocalData(dbId);
          currentData[table.name] = Array.isArray(rows) ? rows : [];
          saveLocalData(dbId, currentData);
        }
      } catch (err) {
        console.error('Failed to fetch data from backend:', err);
        // Fall back to localStorage
        const localData = loadLocalData(localStorage.getItem(ACTIVE_DB_KEY));
        setTableData(localData[table.name] || []);
      } finally {
        setDataLoading(false);
      }
    } else {
      // Database not yet used in app - use localStorage
      const localData = loadLocalData(localStorage.getItem(ACTIVE_DB_KEY));
      setTableData(localData[table.name] || []);
    }
  };

  useEffect(() => {
    setColumns(table.columns || []);
    setPrimaryKey(table.primaryKey || []);
    setForeignKeys(table.foreignKeys || []);
    setIndexes(table.indexes || []);
    
    // Reset pagination when table changes
    setDataOffset(0);
  }, [table]);
  
  useEffect(() => {
    // Load table data when table, connectionId, or pagination changes
    loadTableData();
  }, [table, activeDb?.connectionId, dataLimit, dataOffset]);

  const handleSave = () => {
    onUpdate({
      ...table,
      columns,
      primaryKey,
      foreignKeys,
      indexes,
    });
  };

  // Data management handlers
  const handleAddRow = async (rowData) => {
    const connectionId = activeDb?.connectionId || activeDb?.id;
    // Remove non-FK primary key fields (auto-increment PKs should not be provided)
    const fkCols = (foreignKeys || []).map(f => f.column);
    const nonFkPks = (primaryKey || []).filter(pk => !fkCols.includes(pk));
    const newRow = Object.fromEntries(Object.entries(rowData).filter(([k]) => !nonFkPks.includes(k)));
    
    // If connected to backend, use API
    if (connectionId) {
      try {
        const createdRow = await createRecord(connectionId, table.name, newRow);
        // Refresh data from backend to get any auto-generated values
        await loadTableData();
      } catch (err) {
        console.error('Failed to create record:', err);
        // Fall back to local storage
        const newData = [...tableData, newRow];
        setTableData(newData);
        
        const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
        if (activeDbId) {
          const currentData = loadLocalData(activeDbId);
          currentData[table.name] = newData;
          saveLocalData(activeDbId, currentData);
        }
      }
    } else {
      // Save to localStorage only
      const newData = [...tableData, newRow];
      setTableData(newData);
      
      const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
      if (activeDbId) {
        const currentData = loadLocalData(activeDbId);
        currentData[table.name] = newData;
        saveLocalData(activeDbId, currentData);
      }
    }
    
    setAddRowOpen(false);
    setNewRowData({});
  };

  const handleUpdateRow = async (index, updatedRow) => {
    const connectionId = activeDb?.connectionId || activeDb?.id;
    const pks = primaryKey || [];
    
    // If connected to backend, use API
    if (connectionId && pks.length > 0) {
      try {
        const originalRow = tableData[index];
        const idOrFilters = pks.length === 1 
          ? originalRow[pks[0]] 
          : Object.fromEntries(pks.map(pk => [pk, originalRow[pk]]));
        
        // Remove non-FK primary key fields from payload
        const fkCols = (foreignKeys || []).map(f => f.column);
        const nonFkPks = (pks || []).filter(pk => !fkCols.includes(pk));
        const payload = Object.fromEntries(Object.entries(updatedRow).filter(([k]) => !nonFkPks.includes(k)));
        await updateRecord(connectionId, table.name, idOrFilters, payload);
        // Refresh data from backend
        await loadTableData();
      } catch (err) {
        console.error('Failed to update record:', err);
        // Fall back to local storage
        const newData = [...tableData];
        newData[index] = updatedRow;
        setTableData(newData);
        
        const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
        if (activeDbId) {
          const currentData = loadLocalData(activeDbId);
          currentData[table.name] = newData;
          saveLocalData(activeDbId, currentData);
        }
      }
    } else {
      // Save to localStorage only
      const newData = [...tableData];
      newData[index] = updatedRow;
      setTableData(newData);
      
      const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
      if (activeDbId) {
        const currentData = loadLocalData(activeDbId);
        currentData[table.name] = newData;
        saveLocalData(activeDbId, currentData);
      }
    }
    
    setEditRowOpen(false);
    setEditingRow(null);
  };

  const handleDeleteRow = async (index) => {
    const connectionId = activeDb?.connectionId || activeDb?.id;
    const pks = primaryKey || [];
    
    // If connected to backend, use API
    if (connectionId && pks.length > 0) {
      try {
        const rowToDelete = tableData[index];
        const idOrFilters = pks.length === 1 
          ? rowToDelete[pks[0]] 
          : Object.fromEntries(pks.map(pk => [pk, rowToDelete[pk]]));
        
        await deleteRecord(connectionId, table.name, idOrFilters);
        // Refresh data from backend
        await loadTableData();
      } catch (err) {
        console.error('Failed to delete record:', err);
        // Fall back to local storage
        const newData = tableData.filter((_, i) => i !== index);
        setTableData(newData);
        
        const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
        if (activeDbId) {
          const currentData = loadLocalData(activeDbId);
          currentData[table.name] = newData;
          saveLocalData(activeDbId, currentData);
        }
      }
    } else {
      // Save to localStorage only
      const newData = tableData.filter((_, i) => i !== index);
      setTableData(newData);
      
      const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
      if (activeDbId) {
        const currentData = loadLocalData(activeDbId);
        currentData[table.name] = newData;
        saveLocalData(activeDbId, currentData);
      }
    }
  };

  const handleAddColumn = (column) => {
    setColumns([...columns, column]);
    setAddColumnOpen(false);
  };

  const handleUpdateColumn = (index, updatedColumn) => {
    const newColumns = [...columns];
    newColumns[index] = updatedColumn;
    setColumns(newColumns);
    setEditingColumn(null);
  };

  const handleDeleteColumn = (index) => {
    const colName = columns[index].name;
    setColumns(columns.filter((_, i) => i !== index));
    setPrimaryKey(primaryKey.filter(pk => pk !== colName));
    setForeignKeys(foreignKeys.filter(fk => fk.column !== colName));
  };

  const handleTogglePrimaryKey = (colName) => {
    if (primaryKey.includes(colName)) {
      setPrimaryKey(primaryKey.filter(pk => pk !== colName));
    } else {
      setPrimaryKey([...primaryKey, colName]);
    }
  };

  const handleAddForeignKey = (fk) => {
    setForeignKeys([...foreignKeys, fk]);
    setAddFkOpen(false);
  };

  const handleDeleteForeignKey = (index) => {
    setForeignKeys(foreignKeys.filter((_, i) => i !== index));
  };

  const handleAddIndex = (idx) => {
    setIndexes([...indexes, idx]);
    setAddIndexOpen(false);
  };

  const handleDeleteIndex = (index) => {
    setIndexes(indexes.filter((_, i) => i !== index));
  };

  // Handle Query Tool - execute SQL query
  const handleExecuteQuery = () => {
    if (!queryText.trim()) {
      setQueryError('Please enter a SQL query');
      setQueryResult(null);
      return;
    }
    
    try {
      const result = executeLocalQuery(queryText, table ? [table] : [], activeDbId);
      setQueryResult(result);
      setQueryError(null);
    } catch (error) {
      setQueryError(error.message);
      setQueryResult(null);
    }
  };

  const hasChanges = JSON.stringify({ columns, primaryKey, foreignKeys, indexes }) !== 
    JSON.stringify({ columns: table.columns, primaryKey: table.primaryKey, foreignKeys: table.foreignKeys, indexes: table.indexes });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">{table.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {columns.length} columns · {foreignKeys.length} relations · {indexes.length} indexes
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<SaveIcon />} 
          onClick={handleSave}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </Box>

      {/* Columns Section */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>Columns</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddColumnOpen(true)}>
            Add Column
          </Button>
        </Box>
        <Box sx={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: `1px solid ${theme.palette.divider}` }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: `1px solid ${theme.palette.divider}` }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>PK</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>Nullable</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: `1px solid ${theme.palette.divider}` }}>Default</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${theme.palette.divider}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, index) => (
                <tr key={col.name} style={{ backgroundColor: theme.palette.mode === 'dark' ? (index % 2 === 0 ? '#1e1e1e' : '#252525') : (index % 2 === 0 ? 'white' : '#fafafa') }}>
                  <td style={{ padding: '12px', borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {col.name}
                      {primaryKey.includes(col.name) && <KeyIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                      {foreignKeys.some(fk => fk.column === col.name) && <LinkIcon sx={{ fontSize: 16, color: 'info.main' }} />}
                    </Box>
                  </td>
                  <td style={{ padding: '12px', borderBottom: `1px solid ${theme.palette.divider}` }}>
                    {col.type.toUpperCase()}{col.maxLength ? `(${col.maxLength})` : ''}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Checkbox 
                      size="small" 
                      checked={primaryKey.includes(col.name)}
                      onChange={() => handleTogglePrimaryKey(col.name)}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Chip size="small" label={col.nullable ? 'Yes' : 'No'} color={col.nullable ? 'default' : 'primary'} />
                  </td>
                  <td style={{ padding: '12px', borderBottom: `1px solid ${theme.palette.divider}`, fontFamily: 'monospace', fontSize: 12 }}>
                    {col.default || '-'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <IconButton size="small" onClick={() => setEditingColumn({ index, column: col })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteColumn(index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>

      {/* Foreign Keys Section */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>Foreign Keys</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddFkOpen(true)} disabled={columns.length === 0}>
            Add Foreign Key
          </Button>
        </Box>
        {foreignKeys.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No foreign keys defined</Typography>
          </Box>
        ) : (
          <List dense>
            {foreignKeys.map((fk, index) => (
              <ListItem key={index} secondaryAction={
                <IconButton size="small" onClick={() => handleDeleteForeignKey(index)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }>
                <ListItemIcon><LinkIcon /></ListItemIcon>
                <ListItemText 
                  primary={`${fk.column} → ${fk.refTable}.${fk.refColumn}`}
                  secondary={`ON DELETE ${fk.onDelete || 'NO ACTION'} · ON UPDATE ${fk.onUpdate || 'NO ACTION'}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Indexes Section */}
      <Paper variant="outlined">
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={600}>Indexes</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAddIndexOpen(true)} disabled={columns.length === 0}>
            Add Index
          </Button>
        </Box>
        {indexes.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No indexes defined</Typography>
          </Box>
        ) : (
          <List dense>
            {indexes.map((idx, index) => (
              <ListItem key={index} secondaryAction={
                <IconButton size="small" onClick={() => handleDeleteIndex(index)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }>
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {idx.name}
                      {idx.unique && <Chip size="small" label="UNIQUE" color="primary" />}
                    </Box>
                  }
                  secondary={`Columns: ${idx.columns.join(', ')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Data Section */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>Data ({tableData.length} rows)</Typography>
            {dataLoading && <Typography variant="caption" color="text.secondary">(loading...)</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={loadTableData} disabled={dataLoading}>
              Refresh
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={() => { setNewRowData({}); setAddRowOpen(true); }}>
              Add Row
            </Button>
          </Box>
        </Box>
        
        {dataLoading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Loading data...</Typography>
          </Box>
        ) : tableData.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No data yet. Click "Add Row" to insert the first record.</Typography>
          </Box>
        ) : (
          <Box sx={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>
                  {columns.map(col => (
                    <th key={col.name} style={{ padding: '12px', textAlign: 'left', borderBottom: `1px solid ${theme.palette.divider}`, fontSize: 12, fontWeight: 600 }}>
                      {col.name}
                    </th>
                  ))}
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${theme.palette.divider}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ backgroundColor: theme.palette.mode === 'dark' ? (rowIndex % 2 === 0 ? '#1e1e1e' : '#252525') : (rowIndex % 2 === 0 ? 'white' : '#fafafa') }}>
                    {columns.map(col => (
                      <td key={col.name} style={{ padding: '12px', borderBottom: `1px solid ${theme.palette.divider}`, fontSize: 13 }}>
                        {row[col.name] !== undefined && row[col.name] !== null ? String(row[col.name]) : '-'}
                      </td>
                    ))}
                    <td style={{ padding: '12px', textAlign: 'right', borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <IconButton 
                        size="small" 
                        onClick={() => { setEditingRow({ index: rowIndex, data: { ...row } }); setEditRowOpen(true); }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteRow(rowIndex)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
        
        {/* Pagination Controls */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
            <TextField
              select
              size="small"
              value={dataLimit}
              onChange={(e) => { setDataLimit(parseInt(e.target.value)); setDataOffset(0); }}
              SelectProps={{ native: true }}
              sx={{ width: 80 }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button 
              size="small" 
              disabled={dataOffset === 0 || dataLoading}
              onClick={() => setDataOffset(Math.max(0, dataOffset - dataLimit))}
            >
              Previous
            </Button>
            <Typography variant="body2" color="text.secondary">
              {dataOffset + 1} - {dataOffset + tableData.length}
            </Typography>
            <Button 
              size="small" 
              disabled={tableData.length < dataLimit || dataLoading}
              onClick={() => setDataOffset(dataOffset + dataLimit)}
            >
              Next
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Add Column Dialog */}
      <ColumnDialog
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        onSave={handleAddColumn}
        existingColumns={columns}
      />

      {/* Edit Column Dialog */}
      <ColumnDialog
        open={editingColumn !== null}
        onClose={() => setEditingColumn(null)}
        onSave={(col) => handleUpdateColumn(editingColumn?.index, col)}
        existingColumns={columns.filter((_, i) => i !== editingColumn?.index)}
        initialData={editingColumn?.column}
      />

      {/* Add Foreign Key Dialog */}
      <ForeignKeyDialog
        open={addFkOpen}
        onClose={() => setAddFkOpen(false)}
        onSave={handleAddForeignKey}
        columns={columns}
        allTables={allTables}
        currentTable={table.name}
      />

      {/* Add Index Dialog */}
      <IndexDialog
        open={addIndexOpen}
        onClose={() => setAddIndexOpen(false)}
        onSave={handleAddIndex}
        columns={columns}
        existingIndexes={indexes}
        tableName={table.name}
      />

      {/* Add Row Dialog */}
      <Dialog open={addRowOpen} onClose={() => setAddRowOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Row</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {columns.map(col => {
            console.log('primaryKey:', primaryKey, 'col.name:', col.name);
            const isPk = Array.isArray(primaryKey) && primaryKey.includes(col.name);
            if (isPk) return null; // Hide PK fields in add mode
            const fk = foreignKeys.find(f => f.column === col.name);
            
            if (fk) {
              // Foreign key column - searchable autocomplete
              const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
              const localDataKey = `${LOCAL_DATA_KEY}_${activeDbId}`;
              const localData = JSON.parse(localStorage.getItem(localDataKey) || '{}');
              const refTableData = localData[fk.refTable] || [];
              const options = refTableData.map(row => row[fk.refColumn]);
              
              return (
                <Autocomplete
                  key={col.name}
                  options={options}
                  value={newRowData[col.name] || null}
                  onChange={(event, newValue) => setNewRowData({ ...newRowData, [col.name]: newValue })}
                  renderInput={(params) => (
                    <TextField {...params} label={col.name} margin="normal" required={!col.nullable} />
                  )}
                  freeSolo
                  fullWidth
                  sx={{ mt: 1, mb: 1 }}
                />
              );
            }
            
            // Regular column
            return (
              <TextField
                key={col.name}
                fullWidth
                label={col.name}
                type={col.type === 'boolean' ? 'checkbox' : col.type.includes('int') ? 'number' : 'text'}
                value={newRowData[col.name] || ''}
                onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                margin="normal"
                required={!col.nullable}
              />
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRowOpen(false)}>Cancel</Button>
          <Button onClick={() => handleAddRow(newRowData)} variant="contained">Add Row</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Row Dialog */}
      <Dialog open={editRowOpen} onClose={() => setEditRowOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Row</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {columns.map(col => {
            const isPk = Array.isArray(primaryKey) && primaryKey.includes(col.name);
            const fk = foreignKeys.find(f => f.column === col.name);
            
            if (fk) {
              // Foreign key column - searchable autocomplete
              const activeDbId = localStorage.getItem(ACTIVE_DB_KEY);
              const localDataKey = `${LOCAL_DATA_KEY}_${activeDbId}`;
              const localData = JSON.parse(localStorage.getItem(localDataKey) || '{}');
              const refTableData = localData[fk.refTable] || [];
              const options = refTableData.map(row => row[fk.refColumn]);
              
              return (
                <Autocomplete
                  key={col.name}
                  options={options}
                  value={editingRow?.data[col.name] || null}
                  onChange={(event, newValue) => {
                    if (editingRow) {
                      const updatedData = { ...editingRow.data, [col.name]: newValue };
                      setEditingRow({ ...editingRow, data: updatedData });
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label={col.name} margin="normal" required={!col.nullable} disabled={isPk} />
                  )}
                  freeSolo
                  fullWidth
                  disabled={isPk}
                  sx={{ mt: 1, mb: 1 }}
                />
              );
            }
            
            // Regular column
            return (
              <TextField
                key={col.name}
                fullWidth
                label={col.name}
                type={col.type === 'boolean' ? 'checkbox' : col.type.includes('int') ? 'number' : 'text'}
                value={editingRow?.data[col.name] || ''}
                onChange={(e) => {
                  if (editingRow) {
                    const updatedData = { ...editingRow.data, [col.name]: e.target.value };
                    setEditingRow({ ...editingRow, data: updatedData });
                  }
                }}
                margin="normal"
                required={!col.nullable}
                disabled={isPk}
              />
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRowOpen(false)}>Cancel</Button>
          <Button onClick={() => handleUpdateRow(editingRow?.index, editingRow?.data)} variant="contained">Update Row</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Column Dialog Component
const ColumnDialog = ({ open, onClose, onSave, existingColumns, initialData }) => {
  const [form, setForm] = useState({
    name: '',
    type: 'varchar',
    maxLength: 255,
    nullable: true,
    default: '',
    unique: false,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm({ name: '', type: 'varchar', maxLength: 255, nullable: true, default: '', unique: false });
    }
    setError(null);
  }, [initialData, open]);

  const handleSave = () => {
    if (!form.name.trim()) {
      setError('Column name is required');
      return;
    }
    if (existingColumns.some(c => c.name === form.name.trim())) {
      setError('Column name already exists');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  const selectedType = DATA_TYPES.find(t => t.name === form.type);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initialData ? 'Edit Column' : 'Add Column'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <TextField
          autoFocus
          fullWidth
          label="Column Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          sx={{ mb: 2, mt: 1 }}
        />
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Data Type</InputLabel>
          <Select
            value={form.type}
            label="Data Type"
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {DATA_TYPES.map(t => (
              <MenuItem key={t.name} value={t.name}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedType?.hasLength && (
          <TextField
            fullWidth
            label="Length"
            type="number"
            value={form.maxLength || ''}
            onChange={(e) => setForm({ ...form, maxLength: e.target.value })}
            sx={{ mb: 2 }}
          />
        )}

        <TextField
          fullWidth
          label="Default Value"
          value={form.default || ''}
          onChange={(e) => setForm({ ...form, default: e.target.value })}
          sx={{ mb: 2 }}
          placeholder="e.g., 'active', 0, NOW()"
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel
            control={<Checkbox checked={form.nullable} onChange={(e) => setForm({ ...form, nullable: e.target.checked })} />}
            label="Nullable"
          />
          <FormControlLabel
            control={<Checkbox checked={form.unique} onChange={(e) => setForm({ ...form, unique: e.target.checked })} />}
            label="Unique"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">{initialData ? 'Update' : 'Add'}</Button>
      </DialogActions>
    </Dialog>
  );
};

// Foreign Key Dialog Component
const ForeignKeyDialog = ({ open, onClose, onSave, columns, allTables, currentTable }) => {
  const [form, setForm] = useState({
    column: '',
    refTable: '',
    refColumn: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  });

  const otherTables = allTables.filter(t => t.name !== currentTable);
  const selectedRefTable = otherTables.find(t => t.name === form.refTable);

  useEffect(() => {
    if (open) {
      setForm({ column: '', refTable: '', refColumn: '', onDelete: 'NO ACTION', onUpdate: 'NO ACTION' });
    }
  }, [open]);

  const handleSave = () => {
    if (!form.column || !form.refTable || !form.refColumn) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Foreign Key</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
          <InputLabel>Column</InputLabel>
          <Select value={form.column} label="Column" onChange={(e) => setForm({ ...form, column: e.target.value })}>
            {columns.map(c => (
              <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Reference Table</InputLabel>
          <Select value={form.refTable} label="Reference Table" onChange={(e) => setForm({ ...form, refTable: e.target.value, refColumn: '' })}>
            {otherTables.map(t => (
              <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedRefTable && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Reference Column</InputLabel>
            <Select value={form.refColumn} label="Reference Column" onChange={(e) => setForm({ ...form, refColumn: e.target.value })}>
              {selectedRefTable.columns?.map(c => (
                <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>On Delete</InputLabel>
            <Select value={form.onDelete} label="On Delete" onChange={(e) => setForm({ ...form, onDelete: e.target.value })}>
              <MenuItem value="NO ACTION">NO ACTION</MenuItem>
              <MenuItem value="CASCADE">CASCADE</MenuItem>
              <MenuItem value="SET NULL">SET NULL</MenuItem>
              <MenuItem value="RESTRICT">RESTRICT</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>On Update</InputLabel>
            <Select value={form.onUpdate} label="On Update" onChange={(e) => setForm({ ...form, onUpdate: e.target.value })}>
              <MenuItem value="NO ACTION">NO ACTION</MenuItem>
              <MenuItem value="CASCADE">CASCADE</MenuItem>
              <MenuItem value="SET NULL">SET NULL</MenuItem>
              <MenuItem value="RESTRICT">RESTRICT</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!form.column || !form.refTable || !form.refColumn}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Index Dialog Component
const IndexDialog = ({ open, onClose, onSave, columns, existingIndexes, tableName }) => {
  const [form, setForm] = useState({
    name: '',
    columns: [],
    unique: false,
  });

  useEffect(() => {
    if (open) {
      setForm({ name: `idx_${tableName}_`, columns: [], unique: false });
    }
  }, [open, tableName]);

  const handleToggleColumn = (colName) => {
    if (form.columns.includes(colName)) {
      setForm({ ...form, columns: form.columns.filter(c => c !== colName) });
    } else {
      setForm({ ...form, columns: [...form.columns, colName] });
    }
  };

  const handleSave = () => {
    if (!form.name || form.columns.length === 0) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Index</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Index Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          sx={{ mb: 2, mt: 1 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Select Columns</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {columns.map(col => (
            <Chip
              key={col.name}
              label={col.name}
              onClick={() => handleToggleColumn(col.name)}
              color={form.columns.includes(col.name) ? 'primary' : 'default'}
              variant={form.columns.includes(col.name) ? 'filled' : 'outlined'}
            />
          ))}
        </Box>

        <FormControlLabel
          control={<Checkbox checked={form.unique} onChange={(e) => setForm({ ...form, unique: e.target.checked })} />}
          label="Unique Index"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!form.name || form.columns.length === 0}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Create Table Dialog Component
const CreateTableDialog = ({ open, onClose, onCreated, existingTables }) => {
  const theme = useTheme();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState([
    { name: 'id', type: 'serial', nullable: false, default: '', unique: false },
  ]);
  const [primaryKey, setPrimaryKey] = useState(['id']);
  const [error, setError] = useState(null);

  const handleAddColumn = () => {
    setColumns([...columns, { name: '', type: 'varchar', maxLength: 255, nullable: true, default: '', unique: false }]);
  };

  const handleRemoveColumn = (index) => {
    const newCols = columns.filter((_, i) => i !== index);
    setColumns(newCols);
    setPrimaryKey(primaryKey.filter(pk => newCols.some(c => c.name === pk)));
  };

  const handleColumnChange = (index, field, value) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    setColumns(newCols);
  };

  const handlePrimaryKeyToggle = (colName) => {
    if (primaryKey.includes(colName)) {
      setPrimaryKey(primaryKey.filter(pk => pk !== colName));
    } else {
      setPrimaryKey([...primaryKey, colName]);
    }
  };

  const handleCreate = () => {
    if (!tableName.trim()) {
      setError('Table name is required');
      return;
    }
    if (existingTables.some(t => t.name === tableName.trim())) {
      setError('Table name already exists');
      return;
    }
    if (columns.length === 0 || columns.some(c => !c.name.trim())) {
      setError('All columns must have a name');
      return;
    }
    
    onCreated({ name: tableName.trim(), columns, primaryKey });
    handleClose();
  };

  const handleClose = () => {
    setError(null);
    setTableName('');
    setColumns([{ name: 'id', type: 'serial', nullable: false, default: '', unique: false }]);
    setPrimaryKey(['id']);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Table</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        <TextField
          autoFocus
          fullWidth
          label="Table Name"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          sx={{ mb: 3, mt: 1 }}
          placeholder="e.g., users, products, orders"
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>Columns</Typography>
        
        <Box sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
          {columns.map((col, index) => (
            <Box 
              key={index} 
              sx={{ 
                display: 'flex', 
                gap: 1, 
                mb: 1, 
                alignItems: 'center',
                p: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
                borderRadius: 1,
              }}
            >
              <TextField
                size="small"
                label="Name"
                value={col.name}
                onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                sx={{ width: 150 }}
              />
              <TextField
                size="small"
                select
                label="Type"
                value={col.type}
                onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                sx={{ width: 140 }}
              >
                {DATA_TYPES.map(t => (
                  <MenuItem key={t.name} value={t.name}>{t.label}</MenuItem>
                ))}
              </TextField>
              {DATA_TYPES.find(t => t.name === col.type)?.hasLength && (
                <TextField
                  size="small"
                  label="Length"
                  type="number"
                  value={col.maxLength || ''}
                  onChange={(e) => handleColumnChange(index, 'maxLength', e.target.value)}
                  sx={{ width: 80 }}
                />
              )}
              <Tooltip title="Primary Key">
                <IconButton 
                  size="small" 
                  color={primaryKey.includes(col.name) ? 'primary' : 'default'}
                  onClick={() => handlePrimaryKeyToggle(col.name)}
                >
                  <KeyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={col.nullable ? 'Nullable' : 'Not Null'}>
                <Chip 
                  size="small" 
                  label={col.nullable ? 'NULL' : 'NOT NULL'}
                  color={col.nullable ? 'default' : 'primary'}
                  variant={col.nullable ? 'outlined' : 'filled'}
                  onClick={() => handleColumnChange(index, 'nullable', !col.nullable)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
              <IconButton size="small" onClick={() => handleRemoveColumn(index)} disabled={columns.length === 1}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>

        <Button size="small" startIcon={<AddIcon />} onClick={handleAddColumn}>
          Add Column
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" startIcon={<AddIcon />}>
          Create Table
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Create Database Dialog Component
const CreateDatabaseDialog = ({ open, onClose, onCreated, existingNames }) => {
  const [dbName, setDbName] = useState('');
  const [autoConnect, setAutoConnect] = useState(true);
  const [error, setError] = useState(null);

  const handleCreate = () => {
    const name = dbName.trim();
    if (!name) {
      setError('Database name is required');
      return;
    }
    if (existingNames.includes(name)) {
      setError('A database with this name already exists');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      setError('Database name must start with a letter or underscore and contain only letters, numbers, and underscores');
      return;
    }
    onCreated(name, autoConnect);
    handleClose();
  };

  const handleClose = () => {
    setDbName('');
    setAutoConnect(true);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Database</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          label="Database Name"
          value={dbName}
          onChange={(e) => setDbName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
          placeholder="e.g., my_database"
          helperText="Use lowercase letters, numbers, and underscores"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <FormControlLabel
          control={<Checkbox checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} />}
          label="Connect automatically"
          sx={{ display: 'block' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" startIcon={<CreateDbIcon />}>
          Create Database
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SchemaBuilder;
