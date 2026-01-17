import React, { useState } from 'react';
import { Box, TextField, List, ListItem, ListItemText, Button, Typography, alpha, useTheme, Chip } from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import AddIcon from '@mui/icons-material/Add';

const friendlyName = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SchemaSidebar = ({ schema = {}, onAddTable = () => {} }) => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const tables = schema ? Object.keys(schema) : [];
  
  const filteredTables = tables.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <TableChartIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight={600}>Tables</Typography>
        <Chip 
          label={tables.length} 
          size="small" 
          sx={{ 
            height: 20, 
            fontSize: 11,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
          }} 
        />
      </Box>
      <TextField 
        size="small" 
        placeholder="Search tables..." 
        fullWidth 
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': { borderRadius: 2 },
        }} 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <List sx={{ flex: 1, overflow: 'auto', mx: -1 }}>
        {filteredTables.map((t) => (
          <ListItem 
            key={t} 
            sx={{ 
              borderRadius: 2,
              mb: 0.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
            secondaryAction={
              <Button 
                size="small" 
                onClick={() => onAddTable(t)}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{ 
                  borderRadius: 2, 
                  textTransform: 'none',
                  minWidth: 'auto',
                }}
              >
                Add
              </Button>
            }
          >
            <ListItemText 
              primary={
                <Typography variant="body2" fontWeight={500}>
                  {friendlyName(t)}
                </Typography>
              } 
              secondary={`${(schema[t]?.columns || []).length} fields`} 
            />
          </ListItem>
        ))}
        {filteredTables.length === 0 && (
          <ListItem>
            <ListItemText 
              primary={
                <Typography variant="body2" color="text.secondary">
                  {search ? 'No matching tables' : 'No schema loaded'}
                </Typography>
              } 
            />
          </ListItem>
        )}
      </List>
    </Box>
  );
};

export default SchemaSidebar;