import React from 'react';
import { Box, TextField, List, ListItem, ListItemText, Button, Typography, Divider } from '@mui/material';

const friendlyName = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SchemaSidebar = ({ schema = {}, onAddTable = () => {}, onApplyTemplate = () => {} }) => {
  const tables = schema ? Object.keys(schema) : [];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Schema</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>Search tables and add them to the canvas to start building your API. Click "Add" to include a table.</Typography>
      <TextField size="small" placeholder="Search tables" fullWidth sx={{ mb: 1 }} />

      <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Quick templates</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button size="small" onClick={() => onApplyTemplate('top-selling')}>Top selling products</Button>
        <Button size="small" onClick={() => onApplyTemplate('monthly-revenue')}>Monthly revenue</Button>
      </Box>

      <Divider sx={{ mb: 1 }} />
      <List dense>
        {tables.map((t) => (
          <ListItem key={t} secondaryAction={<Button size="small" onClick={() => onAddTable(t)}>Add</Button>}>
            <ListItemText primary={friendlyName(t)} secondary={`${(schema[t]?.columns || []).length} fields`} />
          </ListItem>
        ))}
        {tables.length === 0 && <ListItem><ListItemText primary="No schema loaded" /></ListItem>}
      </List>
    </Box>
  );
};

export default SchemaSidebar;