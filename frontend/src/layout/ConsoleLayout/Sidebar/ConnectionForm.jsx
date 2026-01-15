import React, { useState, useEffect } from 'react';
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
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { testConnection, introspectConnection } from '../../../services/api';

const ConnectionForm = ({ onConnectionSaved, onSchemaLoaded }) => {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    defaultValues: {
      id: '',
      host: 'localhost',
      port: 5432,
      database: '',
      user: 'postgres',
      password: '',
      type: 'postgres',
      uri: '',
      encrypt: false,
    },
  });

  const type = watch('type');
  const uri = watch('uri');
  const encrypt = watch('encrypt');

  useEffect(() => {
    const portMap = { postgres: 5432, mysql: 3306, mongodb: 27017, mssql: 1433, oracle: 1521 };
    setValue('port', portMap[type] || 5432);
    // clear auth for MongoDB by default
    if (type === 'mongodb') {
      setValue('user', '');
      setValue('password', '');
    }
  }, [type, setValue]);

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
        uri: data.uri,
        encrypt: data.encrypt,
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
        uri: data.uri,
        encrypt: data.encrypt,
      });

      const connection = {
        id: connectionId,
        name: data.database || data.uri || connectionId,
        host: data.host,
        port: data.port,
        database: data.database,
        user: data.user,
        password: data.password,
        type: data.type,
        uri: data.uri,
        encrypt: data.encrypt,
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
                <MenuItem value="mongodb">MongoDB</MenuItem>
                <MenuItem value="mssql">MS SQL Server</MenuItem>
                <MenuItem value="oracle">Oracle</MenuItem>
              </Select>

              {/* Derived validation flags */}
              {/** compute flags for conditional validation **/}
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


          {/* MongoDB URI (optional) */}
          {type === 'mongodb' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="MongoDB URI (optional)"
                {...register('uri')}
                helperText="e.g., mongodb://user:pass@host:27017/dbname"
              />
            </Grid>
          )}

          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Host"
              {...register('host', { required: !(type === 'mongodb' && uri) ? 'Host is required' : false })}
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
              {...register('database', { required: !(type === 'mongodb' && uri) ? 'Database is required' : false })}
              error={!!errors.database}
              helperText={errors.database?.message}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="User"
              {...register('user', { required: type !== 'mongodb' ? 'User is required' : false })}
              error={!!errors.user}
              helperText={errors.user?.message}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Password"
              type="password"
              {...register('password', { required: type !== 'mongodb' ? 'Password is required' : false })}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
          </Grid>

          {/* MSSQL specific options */}
          {type === 'mssql' && (
            <Grid item xs={12}>
              <FormControlLabel control={<Checkbox {...register('encrypt')} />} label="Encrypt (MSSQL)" />
            </Grid>
          )}
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {testResult && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Connection successful! {testResult.timestamp ? `Server time: ${new Date(testResult.timestamp).toLocaleString()}` : `Result: ${JSON.stringify(testResult.info)}`}
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
