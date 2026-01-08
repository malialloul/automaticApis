const STORAGE_KEY = 'automaticapis_connections';

export const saveConnections = (connections) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadConnections = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return [];
  }
};

export const saveConnection = (connection) => {
  const connections = loadConnections();
  const existingIndex = connections.findIndex(c => c.id === connection.id);
  
  if (existingIndex >= 0) {
    connections[existingIndex] = connection;
  } else {
    connections.push(connection);
  }
  
  saveConnections(connections);
};

export const deleteConnection = (connectionId) => {
  const connections = loadConnections();
  const filtered = connections.filter(c => c.id !== connectionId);
  saveConnections(filtered);
};

export const getConnection = (connectionId) => {
  const connections = loadConnections();
  return connections.find(c => c.id === connectionId);
};
