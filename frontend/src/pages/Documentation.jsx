import React from 'react';
import { Container, Paper, Typography, Box, Button } from '@mui/material';
import SwaggerUI from 'swagger-ui-react';
import ImplementationSnippets from '../components/ImplementationSnippets';
import 'swagger-ui-react/swagger-ui.css';

const Documentation = ({ connection }) => {
  if (!connection) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5">
            Please select a connection to view API documentation
          </Typography>
        </Paper>
      </Container>
    );
  }

  const swaggerUrl = `/api/connections/${connection.id}/swagger`;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            API Documentation - {connection.name || connection.database}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => window.open(swaggerUrl, '_blank')}
          >
            Download OpenAPI Spec
          </Button>
        </Box>
      </Paper>

      <Paper elevation={3}>
        <SwaggerUI url={swaggerUrl} />
      </Paper>

      <Box sx={{ mt: 3 }}>
        <ImplementationSnippets connectionId={connection.id} />
      </Box>
    </Container>
  );
};

export default Documentation;
