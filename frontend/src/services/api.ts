import axios from 'axios';
import type { SchemaMap } from '../../../backend/src/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

import type { SchemaMap, TableSchema } from '../../../backend/src/types';
import axios from 'axios';

const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

const LOCAL_SCHEMA_KEY = 'local_database_schemas';

export const saveLocalSchema = async (connectionId: string, schema: SchemaMap): Promise<SchemaMap> => {
  try {
    const hasTablesArray = Array.isArray((schema as { tables?: TableSchema[] }).tables);
    const isKeyedFormat = !hasTablesArray && typeof schema === 'object' && Object.keys(schema).length > 0 && (Object.values(schema)[0] as TableSchema)?.columns !== undefined;
    let requestPayload: { schema: SchemaMap };
    if (isKeyedFormat) {
      requestPayload = { schema };
    } else if (hasTablesArray) {
      const schemaTables = (schema as { tables: TableSchema[] }).tables || [];
      const formattedSchema: SchemaMap = {};
      schemaTables.forEach(table => {
        formattedSchema[table.name] = {
          columns: table.columns || [],
          primaryKeys: (table as TableSchema & { primaryKey?: string[] }).primaryKey || table.primaryKeys || [],
          foreignKeys: (table.foreignKeys || []).map((fk: { column?: string; columnName?: string; refTable?: string; foreignTable?: string; refColumn?: string; foreignColumn?: string; onDelete?: string; onUpdate?: string }) => ({
            columnName: fk.column || fk.columnName || '',
            foreignTable: fk.refTable || fk.foreignTable || '',
            foreignColumn: fk.refColumn || fk.foreignColumn || '',
            onDelete: fk.onDelete || 'NO ACTION',
            onUpdate: fk.onUpdate || 'NO ACTION',
          })),
          indexes: table.indexes || [],
          name: table.name,
        };
      });
      requestPayload = { schema: formattedSchema };
    } else {
      requestPayload = { schema };
    }
    const response = await api.post(`/connections/${connectionId}/schema`, requestPayload);
    return response.data;
  } catch (e) {
    throw e;
  }
};

export const getLocalSchema = (_connectionId: string): null => {
  return null;
};

  try {
    api.delete(`/connections/${connectionId}/schema`).catch(() => {});
  } catch {
    // ignore
  }
};

export const testConnection = async (config: Record<string, string | number | boolean>): Promise<{ success: boolean; message: string; timestamp?: string }> => {
  const response = await api.post('/connections/test', config);
  return response.data;
};

export const introspectConnection = async (connectionId: string, config: Record<string, string | number | boolean>): Promise<{ success: boolean; connectionId: string; schema: SchemaMap }> => {
  const response = await api.post(`/connections/${connectionId}/introspect`, config);
  return response.data;
};

export const getSchema = async (connectionId: string): Promise<SchemaMap> => {
  const response = await api.get(`/connections/${connectionId}/schema`);
  return response.data;
};

  const response = await api.post(`/connections/${connectionId}/schema`, { schema });
  return response.data as SchemaMap;
};

  const response = await api.get(`/connections/${connectionId}/operators`);
  return response.data as Record<string, string[]>;
};

  const response = await api.get(`/${connectionId}/__generated_endpoints`);
  return response.data.endpoints as string[];
};

  const response = await api.get(`/connections/${connectionId}/swagger`);
  return response.data;
};

  const response = await api.post(`/connections/${connectionId}/import-sql`, { sql, dialect });
  return response.data as SchemaMap;
};

  const response = await api.post(`/endpoints`, payload);
  return response.data;
};

  const response = await api.get(`/endpoints`);
  return response.data as string[];
};

  const response = await api.get(`/endpoints/${slug}`);
  return response.data;
};

  const response = await api.put(`/endpoints/${slug}`, payload);
  return response.data;
};

  const response = await api.delete(`/endpoints/${slug}`);
  return response.data;
};

  const response = await api.post(`/connections/${connectionId}/preview`, { graph, limit });
  return response.data;
};

  const response = await api.post(`/connections/${connectionId}/execute`, { 
    operation, 
    graph, 
    previewOnly: true,
    data: operation === 'INSERT' || operation === 'UPDATE' ? { _preview: true } : undefined,
  });
  return response.data;
};

  const response = await api.get('/connections');
  return response.data as { id: string }[];
};

  const response = await api.delete(`/connections/${connectionId}`);
  return response.data;
};

  const response = await api.get(`/${connectionId}/${table}`, { params });
  return response.data;
};

  const response = await api.get(`/${connectionId}/${table}/${id}`);
  return response.data;
};

  const response = await api.post(`/${connectionId}/${table}`, data);
  return response.data;
};

  if (Array.isArray(ids)) {
    throw new Error('updateRecord expects a single id or an object mapping primary key names to values (e.g. { id: 1 } or { a: 1, b: 2 }), not an array of column names');
  }
  if (ids && typeof ids === 'object') {
    const params = new URLSearchParams();
    Object.entries(ids).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        (v as (string | number)[]).forEach((vv) => params.append(k, String(vv)));
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

  if (idOrFilters && typeof idOrFilters === 'object' && !Array.isArray(idOrFilters)) {
    const params = new URLSearchParams();
    Object.entries(idOrFilters).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        (v as (string | number)[]).forEach((vv) => params.append(k, String(vv)));
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

  const response = await api.get(`/${connectionId}/${table}/${id}/${relatedTable}`, { params });
  return response.data;
};

export const schemaBuilder = {
  getTables: async (connectionId: string): Promise<{ tables: { name: string; schema: string }[] }> => {
    const response = await api.get(`/schema-builder/${connectionId}/tables`);
    return response.data;
  },
  getTableDetails: async (connectionId: string, tableName: string, schema: string = 'public'): Promise<{ tableName: string; schema: string; columns: unknown[]; constraints: unknown[]; indexes: unknown[] } | { error: string }> => {
    const response = await api.get(`/schema-builder/${connectionId}/tables/${tableName}`, { params: { schema } });
    return response.data;
  },
  createTable: async (connectionId: string, payload: Record<string, string | number | boolean | unknown[]>, preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.post(`/schema-builder/${connectionId}/tables`, { ...payload, preview });
    return response.data;
  },
  renameTable: async (connectionId: string, tableName: string, newName: string, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.put(`/schema-builder/${connectionId}/tables/${tableName}`, { newName, schema, preview });
    return response.data;
  },
  dropTable: async (connectionId: string, tableName: string, schema: string = 'public', cascade = false, preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}`, { 
      params: { schema, cascade, preview } 
    });
    return response.data;
  },
  addColumn: async (connectionId: string, tableName: string, column: Record<string, string | number | boolean>, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/columns`, { column, schema, preview });
    return response.data;
  },
  modifyColumn: async (connectionId: string, tableName: string, columnName: string, changes: Record<string, string | number | boolean>, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.put(`/schema-builder/${connectionId}/tables/${tableName}/columns/${columnName}`, { ...changes, schema, preview });
    return response.data;
  },
  dropColumn: async (connectionId: string, tableName: string, columnName: string, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}/columns/${columnName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },
  addConstraint: async (connectionId: string, tableName: string, constraint: Record<string, string | number | boolean>, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/constraints`, { constraint, schema, preview });
    return response.data;
  },
  dropConstraint: async (connectionId: string, tableName: string, constraintName: string, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.delete(`/schema-builder/${connectionId}/tables/${tableName}/constraints/${constraintName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },
  createIndex: async (connectionId: string, tableName: string, index: Record<string, string | number | boolean>, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.post(`/schema-builder/${connectionId}/tables/${tableName}/indexes`, { index, schema, preview });
    return response.data;
  },
  dropIndex: async (connectionId: string, indexName: string, schema: string = 'public', preview = false): Promise<{ success: boolean; sql?: string; error?: string }> => {
    const response = await api.delete(`/schema-builder/${connectionId}/indexes/${indexName}`, { 
      params: { schema, preview } 
    });
    return response.data;
  },
  executeSql: async (connectionId: string, sql: string): Promise<{ success: boolean; rowCount: number; rows: Record<string, string | number | boolean>[]; fields?: { name: string; dataTypeID?: number }[] }> => {
    const response = await api.post(`/schema-builder/${connectionId}/execute`, { sql });
    return response.data;
  },
  getDataTypes: async (connectionId: string): Promise<{ dataTypes: { name: string; label: string; category: string; hasPrecision?: boolean; hasLength?: boolean }[] }> => {
    const response = await api.get(`/schema-builder/${connectionId}/data-types`);
    return response.data;
  },
  createDatabase: async (config: Record<string, string | number | boolean>): Promise<{ success: boolean; connectionId: string; schema: SchemaMap }> => {
    const response = await api.post('/schema-builder/create-database', config);
    return response.data;
  },
};

export default api;
