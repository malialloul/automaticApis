import React from 'react';
import { Container, Grid } from '@mui/material';
import EndpointExplorer from '../components/EndpointExplorer';
import APITester from '../components/APITester';
import ImplementationSnippets from '../components/ImplementationSnippets';

const APIs = ({ connection }) => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <EndpointExplorer connectionId={connection?.id} />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <APITester connectionId={connection?.id} />
        </Grid>

        <Grid item xs={12}>
          <ImplementationSnippets connectionId={connection?.id} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default APIs;
