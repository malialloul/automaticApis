import React from 'react';
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { loadConnections } from '../utils/storage';

const ConnectionList = ({ currentConnection, onSelect, onDelete }) => {
  const connections = loadConnections();

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
              <IconButton 
                edge="end" 
                aria-label="delete"
                onClick={() => onDelete(conn.id)}
              >
                <DeleteIcon />
              </IconButton>
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
