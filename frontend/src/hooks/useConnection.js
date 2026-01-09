import { useState, useEffect } from 'react';
import { saveConnection, getConnection, deleteConnection as deleteStoredConnection } from '../utils/storage';

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
    window.addEventListener('connection-updated', onUpdate);
    window.addEventListener('connections-changed', onUpdate);
    return () => {
      window.removeEventListener('connection-updated', onUpdate);
      window.removeEventListener('connections-changed', onUpdate);
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
    window.dispatchEvent(new CustomEvent('connection-updated'));
  };

  const saveCurrentConnection = (connection) => {
    saveConnection(connection);
    setCurrentConnection(connection);
    localStorage.setItem('lastConnectionId', connection.id);
    window.dispatchEvent(new CustomEvent('connections-changed'));
    window.dispatchEvent(new CustomEvent('connection-updated'));
  };

  const deleteConnection = (connectionId) => {
    deleteStoredConnection(connectionId);
    if (currentConnection?.id === connectionId) {
      setCurrentConnection(null);
      setSchema(null);
      localStorage.removeItem('lastConnectionId');
    }
    window.dispatchEvent(new CustomEvent('connections-changed'));
    window.dispatchEvent(new CustomEvent('connection-updated'));
  };

  const updateSchema = (newSchema) => {
    setSchema(newSchema);
    window.dispatchEvent(new CustomEvent('connection-updated'));
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
