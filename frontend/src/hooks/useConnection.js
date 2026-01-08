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
  }, []);

  const selectConnection = (connection) => {
    setCurrentConnection(connection);
    setSchema(null);
    localStorage.setItem('lastConnectionId', connection.id);
  };

  const saveCurrentConnection = (connection) => {
    saveConnection(connection);
    setCurrentConnection(connection);
    localStorage.setItem('lastConnectionId', connection.id);
  };

  const deleteConnection = (connectionId) => {
    deleteStoredConnection(connectionId);
    if (currentConnection?.id === connectionId) {
      setCurrentConnection(null);
      setSchema(null);
      localStorage.removeItem('lastConnectionId');
    }
  };

  const updateSchema = (newSchema) => {
    setSchema(newSchema);
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
