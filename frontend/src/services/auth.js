import axios from 'axios';

// Use dedicated backend URL to avoid colliding with Vite dev server
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const api = axios.create({ baseURL: `${BACKEND_URL}/api`, headers: { 'Content-Type': 'application/json' } });

export const getPlans = async () => {
  const res = await api.get('/plans');
  return res.data.plans || [];
};

export const signup = async (payload) => {
  const res = await api.post('/auth/signup', payload);
  return res.data;
};

export const login = async (payload) => {
  const res = await api.post('/auth/login', payload);
  return res.data;
};

export const me = async (token) => {
  const res = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  return res.data.user;
};

export default { getPlans, signup, login, me };
