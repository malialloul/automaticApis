import React from 'react';
import { Container, Grid, Box } from '@mui/material';
import ConnectionForm from '../components/ConnectionForm';
import ConnectionList from '../components/ConnectionList';
import Dashboard from '../components/Dashboard';

const Home = ({ connection, onConnectionSaved, onConnectionSelect, onConnectionDelete, onSchemaLoaded }) => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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

export default Home;
