import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { testConnection, introspectConnection } from '../services/api';

const ConnectionForm = ({ onConnectionSaved, onSchemaLoaded }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      id: '',
      host: 'localhost',
      port: 5432,
      database: '',
      user: 'postgres',
      password: '',
      type: 'postgres',
    },
  });

  const [testing, setTesting] = useState(false);
  const [introspecting, setIntrospecting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const onTest = async (data) => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testConnection({
        host: data.host,
        port: parseInt(data.port, 10),
        database: data.database,
        user: data.user,
        password: data.password,
        type: data.type,
      });
      setTestResult(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (data) => {
    setIntrospecting(true);
    setError(null);

    try {
      const connectionId = data.id || `conn_${Date.now()}`;
      
      const result = await introspectConnection(connectionId, {
        host: data.host,
        port: parseInt(data.port, 10),
        database: data.database,
        user: data.user,
        password: data.password,
        type: data.type,
      });

      const connection = {
        id: connectionId,
        name: data.database,
        host: data.host,
        port: data.port,
        database: data.database,
        user: data.user,
        password: data.password,
        type: data.type,
        introspectedAt: new Date().toISOString(),
      };

      onConnectionSaved(connection);
      if (onSchemaLoaded) {
        onSchemaLoaded(result);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIntrospecting(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Database Connection
      </Typography>
      
      <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel id="db-type-label">Database Type</InputLabel>
              <Select
                labelId="db-type-label"
                label="Database Type"
                defaultValue="postgres"
                {...register('type')}
              >
                <MenuItem value="postgres">PostgreSQL</MenuItem>
                <MenuItem value="mysql">MySQL</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Connection ID (optional)"
              {...register('id')}
              helperText="Leave empty to auto-generate"
            />
          </Grid>
          

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Host"
              {...register('host', { required: 'Host is required' })}
              error={!!errors.host}
              helperText={errors.host?.message}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Port"
              type="number"
              {...register('port', { required: 'Port is required' })}
              error={!!errors.port}
              helperText={errors.port?.message}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Database"
              {...register('database', { required: 'Database is required' })}
              error={!!errors.database}
              helperText={errors.database?.message}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="User"
              {...register('user', { required: 'User is required' })}
              error={!!errors.user}
              helperText={errors.user?.message}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Password"
              type="password"
              {...register('password', { required: 'Password is required' })}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {testResult && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Connection successful! Server time: {new Date(testResult.timestamp).toLocaleString()}
          </Alert>
        )}

        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSubmit(onTest)}
            disabled={testing || introspecting}
          >
            {testing ? <CircularProgress size={24} /> : 'Test Connection'}
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={testing || introspecting}
          >
            {introspecting ? <CircularProgress size={24} /> : 'Connect & Introspect'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default ConnectionForm;
