import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Local schema storage for Schema Builder databases
const LOCAL_SCHEMA_KEY = 'local_database_schemas';

export const saveLocalSchema = async (connectionId, schema) => {
  try {
    // Check if schema is already in app format (from convertToAppSchema) or raw SchemaBuilder format
    if (schema.tables) {
      // Convert SchemaBuilder format to Schema page format
      // SchemaBuilder: { tables: [{ name, columns, primaryKey, foreignKeys: [{column, refTable, refColumn}] }] }
      // Schema page: { tableName: { columns, primaryKeys, foreignKeys: [{columnName, foreignTable, foreignColumn}] } }
      const schemaTables = schema.tables || [];
      const formattedSchema = {};
      
      schemaTables.forEach(table => {
        formattedSchema[table.name] = {
          columns: table.columns || [],
          primaryKeys: table.primaryKey || [],
          // Convert FK format from SchemaBuilder to Schema page format
          foreignKeys: (table.foreignKeys || []).map(fk => ({
            columnName: fk.column || fk.columnName,
            foreignTable: fk.refTable || fk.foreignTable,
            foreignColumn: fk.refColumn || fk.foreignColumn,
            onDelete: fk.onDelete || 'NO ACTION',
            onUpdate: fk.onUpdate || 'NO ACTION',
          })),
          indexes: table.indexes || [],
        };
      });
      
      // Save to backend
      const response = await api.post(`/connections/${connectionId}/schema`, { schema: formattedSchema });
      return response.data;
    } else {
      // Schema is already in app format (keyed by table name)
      const response = await api.post(`/connections/${connectionId}/schema`, { schema });
      return response.data;
    }
  } catch (e) {
    console.error('Failed to save schema to backend:', {
      connectionId,
      error: e?.message,
      status: e?.response?.status,
      data: e?.response?.data
    });
    throw e;
  }
};

export const getLocalSchema = (connectionId) => {
  // Always fetch from backend when available
  return null; // Frontend will use backend via getSchema()
};

export const deleteLocalSchema = (connectionId) => {
  try {
    // Delete from backend
    api.delete(`/connections/${connectionId}/schema`).catch(() => {});
  } catch (e) {
    console.error('Failed to delete schema:', e);
  }
};

// Connection management
export const testConnection = async (config) => {
  const response = await api.post('/connections/test', config);
  return response.data;
};

export const introspectConnection = async (connectionId, config) => {
  const response = await api.post(`/connections/${connectionId}/introspect`, config);
  return response.data;
};

export const getSchema = async (connectionId) => {
  const response = await api.get(`/connections/${connectionId}/schema`);
  return response.data;
};

export const saveSchemaToBackend = async (connectionId, schema) => {
  const response = await api.post(`/connections/${connectionId}/schema`, { schema });
  return response.data;
};

export const getOperators = async (connectionId) => {
  const response = await api.get(`/connections/${connectionId}/operators`);
  return response.data;
};

export const getEndpoints = async (connectionId) => {
  const response = await api.get(`/${connectionId}/__generated_endpoints`);
  return response.data.endpoints;
};


export const getSwagger = async (connectionId) => {
  const response = await api.get(`/connections/${connectionId}/swagger`);
  return response.data;
};

// Import full SQL script (CREATE TABLE + INSERT) into a local connection
export const importSql = async (connectionId, sql, dialect = 'MySQL') => {
  const response = await api.post(`/connections/${connectionId}/import-sql`, { sql, dialect });
  return response.data;
};

// Endpoints management
export const createEndpoint = async (payload) => {
  const response = await api.post(`/endpoints`, payload);
  return response.data;
};

export const listEndpoints = async () => {
  const response = await api.get(`/endpoints`);
  return response.data;
};

export const getEndpoint = async (slug) => {
  const response = await api.get(`/endpoints/${slug}`);
  return response.data;
};

export const updateEndpoint = async (slug, payload) => {
  const response = await api.put(`/endpoints/${slug}`, payload);
  return response.data;
};

export const deleteEndpoint = async (slug) => {
  const response = await api.delete(`/endpoints/${slug}`);
  return response.data;
};

// Preview API: server-side translation of graph -> sample rows
export const previewGraph = async (connectionId, graph, limit = 5) => {
  const response = await api.post(`/connections/${connectionId}/preview`, { graph, limit });
  return response.data;
};

// Preview SQL for write operations (INSERT/UPDATE/DELETE)
export const previewExecuteSql = async (connectionId, operation, graph) => {
  const response = await api.post(`/connections/${connectionId}/execute`, { 
    operation, 
    graph, 
    previewOnly: true,
    // Provide dummy data for INSERT/UPDATE preview
    data: operation === 'INSERT' || operation === 'UPDATE' ? { _preview: true } : undefined,
  });
  return response.data;
};

export const getConnections = async () => {
  const response = await api.get('/connections');
  return response.data;
};

export const closeConnection = async (connectionId) => {
  const response = await api.delete(`/connections/${connectionId}`);
  return response.data;
};

// Dynamic CRUD operations
export const listRecords = async (connectionId, table, params = {}) => {
  const response = await api.get(`/${connectionId}/${table}`, { params });
  return response.data;
};

export const getRecord = async (connectionId, table, id) => {
  const response = await api.get(`/${connectionId}/${table}/${id}`);
  return response.data;
};

export const createRecord = async (connectionId, table, data) => {
  const response = await api.post(`/${connectionId}/${table}`, data);
  return response.data;
};

export const updateRecord = async (connectionId, table, ids, data) => {
  // Reject arrays (previous bug: passing an array of PK names instead of values)
  if (Array.isArray(ids)) {
    throw new Error('updateRecord expects a single id or an object mapping primary key names to values (e.g. { id: 1 } or { a: 1, b: 2 }), not an array of column names');
  }

  if (ids && typeof ids === 'object') {
    // Treat as filters for PUT /collection?key1=val1&key2=val2
    const params = new URLSearchParams();
    Object.entries(ids).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        v.forEach((vv) => params.append(k, String(vv)));
      } else {
        params.append(k, String(v));
      }
    });
    const qs = params.toString();
    const url = qs ? `/${connectionId}/${table}?${qs}` : `/${connectionId}/${table}`;
    const response = await api.put(url, data);
    return response.data;
  }
  const response = await api.put(`/${connectionId}/${table}/${ids}`, data);
  return response.data;
};

export const deleteRecord = async (connectionId, table, idOrFilters) => {
  if (idOrFilters && typeof idOrFilters === 'object' && !Array.isArray(idOrFilters)) {
    // Treat as filters for DELETE /collection?key1=val1&key2=val2
    const params = new URLSearchParams();
    Object.entries(idOrFilters).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        v.forEach((vv) => params.append(k, String(vv)));
      } else {
        params.append(k, String(v));
      }
    });
    const qs = params.toString();
    const url = qs ? `/${connectionId}/${table}?${qs}` : `/${connectionId}/${table}`;
    const response = await api.delete(url);
    return response.data;
  }
  const response = await api.delete(`/${connectionId}/${table}/${idOrFilters}`);
  return response.data;
};

export const getRelatedRecords = async (connectionId, table, id, relatedTable, params = {}) => {
  const response = await api.get(`/${connectionId}/${table}/${id}/${relatedTable}`, { params });
  return response.data;
};

// Schema Builder API
export const schemaBuilder = {
  // Get all tables
  getTables: async (connectionId) => {
    const response = await api.get(`/schema-builder/${connectionId}/tables`);
    return response.data;
  },

  // Get table details (columns, constraints, indexes)
  getTableDetails: async (connectionId, tableName, schema = 'public') => {
    const response = await api.get(`/schema-builder/${connectionId}/tables/${tableName}`, { params: { schema } });
    return response.data;
  },

  // Create a new table
  createTable: async (connectionId, payload, preview = false) => {
    const response = await api.post(`/schema-builder/${connectionId}/tables`, { ...payload, preview });
    return response.data;
  },

  // Rename a table
  renameTable: async (connectionId, tableName, newName, schema = 'public', preview = false) => {
    const response = await api.put(`/schema-builder/${connectionId}/tables/${tableName}`, { newName, schema, preview });
    return response.data;
  },

  // Drop a table
  dropTable: async (connectionId, tableName, schema = 'public', cascade = false, preview = false) => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}`, { 
      params: { schema, cascade, preview } 
    });
    return response.data;
  },

  // Add a column
  addColumn: async (connectionId, tableName, column, schema = 'public', preview = false) => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/columns`, { column, schema, preview });
    return response.data;
  },

  // Modify a column
  modifyColumn: async (connectionId, tableName, columnName, changes, schema = 'public', preview = false) => {
    const response = await api.put(`/schema-builder/${connectionId}/tables/${tableName}/columns/${columnName}`, { ...changes, schema, preview });
    return response.data;
  },

  // Drop a column
  dropColumn: async (connectionId, tableName, columnName, schema = 'public', preview = false) => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}/columns/${columnName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },

  // Add a constraint
  addConstraint: async (connectionId, tableName, constraint, schema = 'public', preview = false) => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/constraints`, { constraint, schema, preview });
    return response.data;
  },

  // Drop a constraint
  dropConstraint: async (connectionId, tableName, constraintName, schema = 'public', preview = false) => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}/constraints/${constraintName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },

  // Create an index
  createIndex: async (connectionId, tableName, index, schema = 'public', preview = false) => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/indexes`, { index, schema, preview });
    return response.data;
  },

  // Drop an index
  dropIndex: async (connectionId, indexName, schema = 'public', preview = false) => {
    const response = await api.delete(`/schema-builder/${connectionId}/indexes/${indexName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },

  // Execute raw SQL
  executeSql: async (connectionId, sql) => {
    const response = await api.post(`/schema-builder/${connectionId}/execute`, { sql });
    return response.data;
  },

  // Get available data types
  getDataTypes: async (connectionId) => {
    const response = await api.get(`/schema-builder/${connectionId}/data-types`);
    return response.data;
  },

  // Create a new database
  createDatabase: async (config) => {
    const response = await api.post('/schema-builder/create-database', config);
    return response.data;
  },
};

export default api;
