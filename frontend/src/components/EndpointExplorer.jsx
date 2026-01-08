import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  TextField,
  Collapse,
  Button,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CodeIcon from '@mui/icons-material/Code';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getSchema } from '../services/api';

const EndpointExplorer = ({ connectionId }) => {
  const [schema, setSchema] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTable, setExpandedTable] = useState(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      try {
        const data = await getSchema(connectionId);
        setSchema(data);
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };
    loadSchema();
  }, [connectionId]);

  if (!schema) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography>No schema loaded. Please introspect a database first.</Typography>
      </Paper>
    );
  }

  const baseUrl = window.location.origin;

  const generateEndpoints = (tableName, tableInfo) => {
    const endpoints = [
      {
        method: 'GET',
        path: `/api/${connectionId}/${tableName}`,
        description: `List all ${tableName}`,
        params: '?limit=100&offset=0&orderBy=id',
      },
      {
        method: 'GET',
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Get single ${tableName} by ID`,
      },
      {
        method: 'POST',
        path: `/api/${connectionId}/${tableName}`,
        description: `Create new ${tableName}`,
      },
      {
        method: 'PUT',
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Update ${tableName}`,
      },
      {
        method: 'DELETE',
        path: `/api/${connectionId}/${tableName}/:id`,
        description: `Delete ${tableName}`,
      },
    ];

    // Add relationship endpoints
    const allRelatedTables = new Set();
    
    tableInfo.foreignKeys?.forEach(fk => {
      allRelatedTables.add(fk.foreignTable);
    });
    
    tableInfo.reverseForeignKeys?.forEach(rfk => {
      allRelatedTables.add(rfk.referencingTable);
    });

    allRelatedTables.forEach(relatedTable => {
      endpoints.push({
        method: 'GET',
        path: `/api/${connectionId}/${tableName}/:id/${relatedTable}`,
        description: `Get related ${relatedTable}`,
        isRelationship: true,
      });
    });

    return endpoints;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(text);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const generateCurlCommand = (endpoint) => {
    const url = `${baseUrl}${endpoint.path}${endpoint.params || ''}`;
    let curl = `curl -X ${endpoint.method} "${url}"`;
    
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      curl += ` -H "Content-Type: application/json" -d '{}'`;
    }
    
    return curl;
  };

  const generateFetchCode = (endpoint) => {
    const url = `${endpoint.path}${endpoint.params || ''}`;
    let code = `fetch('${url}'`;
    
    if (endpoint.method !== 'GET') {
      code += `, {\n  method: '${endpoint.method}'`;
      if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
        code += `,\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({})`;
      }
      code += `\n}`;
    }
    
    code += `)\n  .then(res => res.json())\n  .then(data => console.log(data));`;
    return code;
  };

  const filteredTables = Object.entries(schema).filter(([tableName]) =>
    tableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMethodColor = (method) => {
    const colors = {
      GET: 'primary',
      POST: 'success',
      PUT: 'warning',
      DELETE: 'error',
    };
    return colors[method] || 'default';
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        API Endpoints
      </Typography>

      <TextField
        fullWidth
        placeholder="Search tables..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      {filteredTables.map(([tableName, tableInfo]) => {
        const endpoints = generateEndpoints(tableName, tableInfo);
        const isExpanded = expandedTable === tableName;

        return (
          <Box key={tableName} sx={{ mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                cursor: 'pointer',
              }}
              onClick={() => setExpandedTable(isExpanded ? null : tableName)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">{tableName}</Typography>
                <Chip label={`${endpoints.length} endpoints`} size="small" />
              </Box>
              <IconButton size="small">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={isExpanded}>
              <List>
                {endpoints.map((endpoint, idx) => (
                  <ListItem
                    key={idx}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
                      <Chip
                        label={endpoint.method}
                        size="small"
                        color={getMethodColor(endpoint.method)}
                      />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
                        {endpoint.path}{endpoint.params || ''}
                      </Typography>
                      <Tooltip title="Copy URL">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(`${baseUrl}${endpoint.path}`)}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                      {endpoint.description}
                      {endpoint.isRelationship && ' (Relationship)'}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<CodeIcon />}
                        onClick={() => copyToClipboard(generateCurlCommand(endpoint))}
                      >
                        {copiedEndpoint === generateCurlCommand(endpoint) ? 'Copied!' : 'cURL'}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CodeIcon />}
                        onClick={() => copyToClipboard(generateFetchCode(endpoint))}
                      >
                        {copiedEndpoint === generateFetchCode(endpoint) ? 'Copied!' : 'fetch'}
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        );
      })}
    </Paper>
  );
};

export default EndpointExplorer;
