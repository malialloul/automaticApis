import { useEffect, useState } from 'react';
import authApi from '../services/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('authToken') || null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const u = await authApi.me(token);
        setUser(u);
      } catch {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
      }
    };
    load();
  }, [token]);

  const login = async (email, password) => {
    const { token: t, user: u } = await authApi.login({ email, password });
    localStorage.setItem('authToken', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const signup = async (name, email, password, plan) => {
    const { token: t, user: u } = await authApi.signup({ name, email, password, plan });
    localStorage.setItem('authToken', t);
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  return { user, token, login, signup, logout };
};
