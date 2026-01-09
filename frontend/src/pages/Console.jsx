import React from 'react';
import { Container, Grid, Paper, Typography } from '@mui/material';
import ConnectionForm from '../components/ConnectionForm';
import ConnectionList from '../components/ConnectionList';
import Dashboard from '../components/Dashboard';

const Console = ({ connection, onConnectionSaved, onSchemaLoaded, onConnectionSelect, onConnectionDelete }) => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Developer Console</Typography>
        <Typography variant="body2" color="text.secondary">Connect to your database and start generating APIs.</Typography>
      </Paper>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ConnectionForm 
            onConnectionSaved={onConnectionSaved}
            onSchemaLoaded={onSchemaLoaded}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ConnectionList
            currentConnection={connection}
            onSelect={onConnectionSelect}
            onDelete={onConnectionDelete}
          />
        </Grid>
        <Grid item xs={12}>
          <Dashboard connectionId={connection?.id} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Console;
