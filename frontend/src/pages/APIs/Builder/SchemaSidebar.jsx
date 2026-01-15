import React, { useState } from 'react';
import { Box, TextField, List, ListItem, ListItemText, Button, Typography } from '@mui/material';

const friendlyName = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SchemaSidebar = ({ schema = {}, onAddTable = () => {} }) => {
  const [search, setSearch] = useState('');
  const tables = schema ? Object.keys(schema) : [];
  
  const filteredTables = tables.filter(t => 
    t.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Tables</Typography>
      <TextField 
        size="small" 
        placeholder="Search tables..." 
        fullWidth 
        sx={{ mb: 1 }} 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <List dense sx={{ flex: 1, overflow: 'auto' }}>
        {filteredTables.map((t) => (
          <ListItem key={t} secondaryAction={<Button size="small" onClick={() => onAddTable(t)}>Add</Button>}>
            <ListItemText primary={friendlyName(t)} secondary={`${(schema[t]?.columns || []).length} fields`} />
          </ListItem>
        ))}
        {filteredTables.length === 0 && <ListItem><ListItemText primary={search ? 'No matching tables' : 'No schema loaded'} /></ListItem>}
      </List>
    </Box>
  );
};

export default SchemaSidebar;