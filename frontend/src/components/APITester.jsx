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
  Tabs,
  Tab,
} from '@mui/material';
import ReactJson from '@microlink/react-json-view';
import { getSchema } from '../services/api';
import api from '../services/api';
import CodeSnippet from './CodeSnippet';

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
  const [activeTab, setActiveTab] = useState(0); // 0 = Test API, 1 = Get Code

  useEffect(() => {
    const loadSchema = async () => {
      if (! connectionId) return;
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
          setError('Invalid JSON in request body.  Please check your syntax.');
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
          result = await api. post(url, parsedBody);
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
        status: result. status,
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

  // Prepare endpoint info for code generation
  const getCurrentEndpoint = () => {
    let path = `/${connectionId}/${selectedTable}`;
    if (recordId && operation !== 'POST') {
      path += '/: id';
    }

    return {
      path,
      method:  operation,
      description: `${operation} ${selectedTable}`,
    };
  };

  const getCodeOptions = () => {
    const baseUrl = api.defaults?. baseURL || 'http://localhost:3001/api';
    const params = {};
    
    // Parse query params
    if (queryParams) {
      const pairs = queryParams.split('&');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = value;
        }
      });
    }

    const pathParams = {};
    if (recordId) {
      pathParams.id = recordId;
    }

    let body = null;
    if ((operation === 'POST' || operation === 'PUT') && requestBody) {
      try {
        body = JSON.parse(requestBody);
      } catch (e) {
        body = {};
      }
    }

    return {
      baseUrl,
      params,
      pathParams,
      body,
    };
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

      {/* Tabs for Test API vs Get Code */}
      <Box sx={{ borderBottom: 1, borderColor:  'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="🧪 Test API" />
          <Tab label="💻 Get Code" />
        </Tabs>
      </Box>

      {/* Common Configuration (shown in both tabs) */}
      <Grid container spacing={2}>
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
            onChange={(e) => setOperation(e.target. value)}
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
              onChange={(e) => setRecordId(e.target. value)}
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
            helperText="Example:  limit=10&offset=0&orderBy=id&orderDir=DESC"
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
              placeholder='{"column":  "value"}'
            />
          </Grid>
        )}
      </Grid>

      {/* Tab Content */}
      {activeTab === 0 ?  (
        // TEST API TAB
        <>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={loading}
                fullWidth
              >
                {loading ?  <CircularProgress size={24} /> : 'Send Request'}
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
                bgcolor:  'grey.900', 
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
        </>
      ) : (
        // GET CODE TAB
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb:  2 }}>
            Copy the code below and embed it directly into your project! 
          </Alert>
          <CodeSnippet
            endpoint={getCurrentEndpoint()}
            options={getCodeOptions()}
          />
        </Box>
      )}
    </Paper>
  );
};

export default APITester;