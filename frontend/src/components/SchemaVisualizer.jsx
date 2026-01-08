import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import { getSchema } from '../services/api';

const SchemaVisualizer = ({ connectionId }) => {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      
      setLoading(true);
      setError(null);

      try {
        const data = await getSchema(connectionId);
        setSchema(data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [connectionId]);

  if (!connectionId) {
    return (
      <Alert severity="info">
        Please select a connection to view schema
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!schema) {
    return <Alert severity="warning">No schema found</Alert>;
  }

  const filteredTables = Object.entries(schema).filter(([tableName]) =>
    tableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Database Schema
      </Typography>

      <TextField
        fullWidth
        placeholder="Search tables..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {filteredTables.length} table(s) found
      </Typography>

      {filteredTables.map(([tableName, tableInfo]) => (
        <Accordion key={tableName} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
              <Typography variant="h6">{tableName}</Typography>
              <Chip label={`${tableInfo.columns.length} columns`} size="small" />
              {tableInfo.foreignKeys?.length > 0 && (
                <Chip 
                  label={`${tableInfo.foreignKeys.length} FK`} 
                  size="small" 
                  color="primary"
                  icon={<LinkIcon />}
                />
              )}
              {tableInfo.reverseForeignKeys?.length > 0 && (
                <Chip 
                  label={`${tableInfo.reverseForeignKeys.length} reverse FK`} 
                  size="small" 
                  color="secondary"
                  icon={<LinkIcon />}
                />
              )}
            </Box>
          </AccordionSummary>
          
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableRow>Column</TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Nullable</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>Keys</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableInfo.columns.map((column) => {
                    const isPK = tableInfo.primaryKeys?.includes(column.name);
                    const fk = tableInfo.foreignKeys?.find(fk => fk.columnName === column.name);
                    
                    return (
                      <TableRow key={column.name}>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            fontWeight={isPK ? 'bold' : 'normal'}
                          >
                            {column.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={column.type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{column.nullable ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {column.default || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {isPK && <Chip label="PK" size="small" color="success" icon={<KeyIcon />} />}
                          {fk && (
                            <Chip 
                              label={`FK → ${fk.foreignTable}`} 
                              size="small" 
                              color="primary"
                              sx={{ ml: 0.5 }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {tableInfo.reverseForeignKeys?.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Referenced By:
                </Typography>
                {tableInfo.reverseForeignKeys.map((rfk, idx) => (
                  <Chip
                    key={idx}
                    label={`${rfk.referencingTable} (${rfk.referencingColumn})`}
                    size="small"
                    sx={{ m: 0.5 }}
                    color="secondary"
                  />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
};

export default SchemaVisualizer;
