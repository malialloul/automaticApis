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

export const updateRecord = async (connectionId, table, id, data) => {
  const response = await api.put(`/${connectionId}/${table}/${id}`, data);
  return response.data;
};

export const deleteRecord = async (connectionId, table, id) => {
  const response = await api.delete(`/${connectionId}/${table}/${id}`);
  return response.data;
};

export const getRelatedRecords = async (connectionId, table, id, relatedTable, params = {}) => {
  const response = await api.get(`/${connectionId}/${table}/${id}/${relatedTable}`, { params });
  return response.data;
};

export default api;
