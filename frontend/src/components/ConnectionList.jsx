import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import { loadConnections } from '../utils/storage';
import { introspectConnection } from '../services/api';

const ConnectionList = ({ currentConnection, onSelect, onDelete }) => {
  const [connections, setConnections] = useState([]);
  const [reconnecting, setReconnecting] = useState(null);

  // Load connections and set up to reload when storage changes
  useEffect(() => {
    const loadAndSetConnections = () => {
      setConnections(loadConnections());
    };

    // Initial load
    loadAndSetConnections();

    // Listen for storage changes (e.g., from another tab or after delete)
    window.addEventListener('storage', loadAndSetConnections);
    
    // Also set up a custom event for same-tab updates
    window.addEventListener('connectionsChanged', loadAndSetConnections);

    return () => {
      window.removeEventListener('storage', loadAndSetConnections);
      window.removeEventListener('connectionsChanged', loadAndSetConnections);
    };
  }, []);

  // Wrap onDelete to trigger reload
  const handleDelete = (connectionId) => {
    onDelete(connectionId);
    // Reload connections after delete
    setConnections(loadConnections());
    // Dispatch event for other components
    window.dispatchEvent(new Event('connectionsChanged'));
  };

  // Handle reconnection with introspection
  const handleReconnect = async (e, conn) => {
    e.stopPropagation(); // Prevent selection while reconnecting
    setReconnecting(conn.id);
    
    try {
      await introspectConnection(conn.id, {
        host: conn.host,
        port: parseInt(conn.port, 10),
        database: conn.database,
        user: conn.user,
        password: conn.password,
      });
      
      // Select the connection after successful introspection
      onSelect(conn);
    } catch (error) {
      console.error('Reconnection failed:', error);
      alert(`Failed to reconnect: ${error.response?.data?.error || error.message}`);
    } finally {
      setReconnecting(null);
    }
  };

  if (connections.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          No saved connections yet. Create your first connection above.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Saved Connections</Typography>
      </Box>
      
      <List>
        {connections.map((conn) => (
          <ListItem
            key={conn.id}
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Reconnect & Re-introspect">
                  <IconButton
                    edge="end"
                    aria-label="reconnect"
                    onClick={(e) => handleReconnect(e, conn)}
                    disabled={reconnecting === conn.id}
                  >
                    {reconnecting === conn.id ? (
                      <CircularProgress size={24} />
                    ) : (
                      <RefreshIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <IconButton 
                  edge="end" 
                  aria-label="delete"
                  onClick={() => handleDelete(conn.id)}
                  disabled={reconnecting === conn.id}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            }
            disablePadding
          >
            <ListItemButton
              selected={currentConnection?.id === conn.id}
              onClick={() => onSelect(conn)}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {conn.name || conn.database}
                    {currentConnection?.id === conn.id && (
                      <CheckCircleIcon color="success" fontSize="small" />
                    )}
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" display="block">
                      {conn.user}@{conn.host}:{conn.port}/{conn.database}
                    </Typography>
                    {conn.introspectedAt && (
                      <Chip 
                        label={`Introspected ${new Date(conn.introspectedAt).toLocaleDateString()}`}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    )}
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default ConnectionList;
