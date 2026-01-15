import { useState, useEffect } from 'react';
import { saveConnection, getConnection, deleteConnection as deleteStoredConnection } from '../../utils/storage';
import { LISTENERS } from '../listeners';

export const useConnection = () => {
  const [currentConnection, setCurrentConnection] = useState(null);
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    // Load last used connection from localStorage
    const lastConnectionId = localStorage.getItem('lastConnectionId');
    if (lastConnectionId) {
      const conn = getConnection(lastConnectionId);
      if (conn) {
        setCurrentConnection(conn);
      }
    }
    // Listen for cross-component updates
    const onUpdate = () => {
      const id = localStorage.getItem('lastConnectionId');
      const conn = id ? getConnection(id) : null;
      setCurrentConnection(conn || null);
      if (!conn) {
        setSchema(null);
      }
    };
    window.addEventListener(LISTENERS.CONNECTION_UPDATED, onUpdate);
    window.addEventListener(LISTENERS.CONNECTIONS_CHANGED, onUpdate);
    return () => {
      window.removeEventListener(LISTENERS.CONNECTION_UPDATED, onUpdate);
      window.removeEventListener(LISTENERS.CONNECTIONS_CHANGED, onUpdate);
    };
  }, []);

  const selectConnection = (connection) => {
    setCurrentConnection(connection);
    setSchema(null);
    if (connection && connection.id) {
      localStorage.setItem('lastConnectionId', connection.id);
    } else {
      localStorage.removeItem('lastConnectionId');
    }
    // Broadcast update to other hook instances
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
  };

  const saveCurrentConnection = (connection) => {
    saveConnection(connection);
    setCurrentConnection(connection);
    localStorage.setItem('lastConnectionId', connection.id);
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
  };

  const deleteConnection = (connectionId) => {
    deleteStoredConnection(connectionId);
    if (currentConnection?.id === connectionId) {
      setCurrentConnection(null);
      setSchema(null);
      localStorage.removeItem('lastConnectionId');
    }
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTIONS_CHANGED));
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
  };

  const updateSchema = (newSchema) => {
    setSchema(newSchema);
    window.dispatchEvent(new CustomEvent(LISTENERS.CONNECTION_UPDATED));
  };

  return {
    currentConnection,
    schema,
    selectConnection,
    saveCurrentConnection,
    deleteConnection,
    updateSchema,
  };
};
