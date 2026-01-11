import { Container, Grid, Drawer } from '@mui/material';
import EndpointExplorer from '../components/EndpointExplorer';
import APITester from '../components/APITester/APITester';
import ImplementationSnippets from '../components/ImplementationSnippets';

import React, { useState } from 'react';

const APIs = ({ connection }) => {
  const [tryItOpen, setTryItOpen] = useState(false);
  const [tryItEndpoint, setTryItEndpoint] = useState(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeEndpoint, setCodeEndpoint] = useState(null);

  // Handlers for EndpointExplorer actions
  const handleTryIt = (endpoint) => {
    setTryItEndpoint(endpoint);
    setTryItOpen(true);
  };
  const handleGetCode = (endpoint) => {
    setCodeEndpoint(endpoint);
    setCodeOpen(true);
  };
  const handleCloseTryIt = () => setTryItOpen(false);
  const handleCloseCode = () => setCodeOpen(false);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <EndpointExplorer
        connectionId={connection?.id}
        onTryIt={handleTryIt}
        onGetCode={handleGetCode}
      />

      {/* Try It Panel */}
      <Drawer anchor="right" open={tryItOpen} onClose={handleCloseTryIt} PaperProps={{ sx: { width: 600 } }}>
        {tryItOpen && (
          <APITester
            connectionId={connection?.id}
            endpoint={tryItEndpoint}
            open={tryItOpen}
            onClose={handleCloseTryIt}
          />
        )}
      </Drawer>

      {/* Get Code Panel */}
      <Drawer anchor="right" open={codeOpen} onClose={handleCloseCode} PaperProps={{ sx: { width: 600 } }}>
        {codeOpen && (
          <ImplementationSnippets
            connectionId={connection?.id}
            endpoint={codeEndpoint}
            open={codeOpen}
            onClose={handleCloseCode}
          />
        )}
      </Drawer>
    </Container>
  );
};

export default APIs;
