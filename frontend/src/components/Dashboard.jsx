import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import ApiIcon from '@mui/icons-material/Api';
import LinkIcon from '@mui/icons-material/Link';
import TableChartIcon from '@mui/icons-material/TableChart';
import { getSchema } from '../services/api';

const Dashboard = ({ connectionId }) => {
  const [schema, setSchema] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;
      
      try {
        const data = await getSchema(connectionId);
        setSchema(data);

        // Calculate statistics
        const tableCount = Object.keys(data).length;
        let columnCount = 0;
        let fkCount = 0;
        let reverseFkCount = 0;

        Object.values(data).forEach(table => {
          columnCount += table.columns.length;
          fkCount += table.foreignKeys?.length || 0;
          reverseFkCount += table.reverseForeignKeys?.length || 0;
        });

        const endpointCount = tableCount * 5 + fkCount + reverseFkCount;

        setStats({
          tableCount,
          columnCount,
          fkCount,
          reverseFkCount,
          relationshipCount: fkCount + reverseFkCount,
          endpointCount,
        });
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };

    loadSchema();
  }, [connectionId]);

  if (!connectionId) {
    return (
      <Alert severity="info">
        Please select or create a database connection to view dashboard
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="warning">
        No statistics available. Please introspect the database first.
      </Alert>
    );
  }

  const StatCard = ({ title, value, icon, color = 'primary' }) => (
    <Card elevation={3}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              bgcolor: `${color}.light`,
              color: `${color}.dark`,
              p: 1.5,
              borderRadius: 2,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard Overview
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Connected to: <strong>{connectionId}</strong>
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tables"
            value={stats.tableCount}
            icon={<TableChartIcon fontSize="large" />}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Columns"
            value={stats.columnCount}
            icon={<StorageIcon fontSize="large" />}
            color="secondary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Relationships"
            value={stats.relationshipCount}
            icon={<LinkIcon fontSize="large" />}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="API Endpoints"
            value={stats.endpointCount}
            icon={<ApiIcon fontSize="large" />}
            color="warning"
          />
        </Grid>
      </Grid>

      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Stats
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>Foreign Keys:</strong> {stats.fkCount}
            </Typography>
            <Typography variant="body2">
              <strong>Reverse Foreign Keys:</strong> {stats.reverseFkCount}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>Avg Columns per Table:</strong>{' '}
              {(stats.columnCount / stats.tableCount).toFixed(1)}
            </Typography>
            <Typography variant="body2">
              <strong>Avg Relationships per Table:</strong>{' '}
              {(stats.relationshipCount / stats.tableCount).toFixed(1)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {schema && (
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Available Tables
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.keys(schema).map(tableName => (
              <Card key={tableName} variant="outlined" sx={{ minWidth: 200 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {tableName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {schema[tableName].columns.length} columns
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default Dashboard;
