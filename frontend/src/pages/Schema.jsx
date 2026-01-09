import React from 'react';
import { Container, Grid } from '@mui/material';
import SchemaVisualizer from '../components/SchemaVisualizer';
import RelationshipGraph from '../components/RelationshipGraph';

const Schema = ({ connection }) => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <SchemaVisualizer connectionId={connection?.id} />
        </Grid>

        <Grid item xs={12}>
          <RelationshipGraph connectionId={connection?.id} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Schema;
