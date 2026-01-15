import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
