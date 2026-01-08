import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  MenuItem,
  Grid,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import ReactJson from '@microlink/react-json-view';
import { getSchema } from '../services/api';
import api from '../services/api';

const APITester = ({ connectionId }) => {
  const [schema, setSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [operation, setOperation] = useState('GET');
  const [recordId, setRecordId] = useState('');
  const [requestBody, setRequestBody] = useState('{}');
  const [queryParams, setQueryParams] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      try {
        const data = await getSchema(connectionId);
        setSchema(data);
        if (Object.keys(data).length > 0) {
          setSelectedTable(Object.keys(data)[0]);
        }
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };
    loadSchema();
  }, [connectionId]);

  const handleSend = async () => {
    if (!selectedTable) {
      setError('Please select a table');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Validate JSON for POST/PUT requests
      let parsedBody = null;
      if ((operation === 'POST' || operation === 'PUT') && requestBody) {
        try {
          parsedBody = JSON.parse(requestBody);
        } catch (jsonError) {
          setError('Invalid JSON in request body. Please check your syntax.');
          setLoading(false);
          return;
        }
      }

      let url = `/${connectionId}/${selectedTable}`;
      
      if (recordId && (operation === 'GET' || operation === 'PUT' || operation === 'DELETE')) {
        url += `/${recordId}`;
      }

      if (queryParams) {
        url += `?${queryParams}`;
      }

      let result;
      const startTime = Date.now();

      switch (operation) {
        case 'GET':
          result = await api.get(url);
          break;
        case 'POST':
          result = await api.post(url, parsedBody);
          break;
        case 'PUT':
          result = await api.put(url, parsedBody);
          break;
        case 'DELETE':
          result = await api.delete(url);
          break;
        default:
          throw new Error('Invalid operation');
      }

      const endTime = Date.now();

      setResponse({
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        data: result.data,
        timing: `${endTime - startTime}ms`,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      if (err.response) {
        setResponse({
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!schema) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography>No schema loaded. Please introspect a database first.</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        API Testing Playground
      </Typography>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <TextField
            select
            fullWidth
            label="Table"
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {Object.keys(schema).map(tableName => (
              <MenuItem key={tableName} value={tableName}>
                {tableName}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            select
            fullWidth
            label="Operation"
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          >
            <MenuItem value="GET">GET - List/Get</MenuItem>
            <MenuItem value="POST">POST - Create</MenuItem>
            <MenuItem value="PUT">PUT - Update</MenuItem>
            <MenuItem value="DELETE">DELETE - Delete</MenuItem>
          </TextField>
        </Grid>

        {(operation !== 'POST') && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Record ID (optional for GET list)"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="Leave empty for GET all records"
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Query Parameters"
            value={queryParams}
            onChange={(e) => setQueryParams(e.target.value)}
            placeholder="limit=10&offset=0&orderBy=id"
            helperText="Example: limit=10&offset=0&orderBy=id&orderDir=DESC"
          />
        </Grid>

        {(operation === 'POST' || operation === 'PUT') && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Request Body (JSON)"
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              placeholder='{"column": "value"}'
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Send Request'}
          </Button>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {response && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Response
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Status:</strong> {response.status} {response.statusText}
            </Typography>
            {response.timing && (
              <Typography variant="body2">
                <strong>Time:</strong> {response.timing}
              </Typography>
            )}
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Response Body:
          </Typography>
          <Box sx={{ 
            bgcolor: 'grey.900', 
            p: 2, 
            borderRadius: 1,
            overflow: 'auto',
            maxHeight: 400,
          }}>
            <ReactJson
              src={response.data}
              theme="monokai"
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={true}
              collapsed={1}
            />
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default APITester;
