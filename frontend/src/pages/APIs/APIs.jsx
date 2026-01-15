import { Container, Grid, Drawer, CircularProgress, Button, Box, Snackbar, Alert } from '@mui/material';
import Builder from './Builder/Builder';
import EndpointExplorer from './EndpointExplorer';
import APITester from './APIsTester/APITester';

import React, { useContext, useState, useRef } from 'react';
import { useConnection } from '../../_shared/database/useConnection';
import { useLoadOperators } from '../../_shared/database/useLoadOperators';
import { AppContext } from '../../App';

const APIs = () => {
  const {
    currentConnection: connection,
  } = useConnection();
  const [tryItOpen, setTryItOpen] = useState(false);
  const [tryItEndpoint, setTryItEndpoint] = useState(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeEndpoint, setCodeEndpoint] = useState(null);
  const { data: operators, loading: operatorsLoading } = useLoadOperators({ connectionId: connection?.id });
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
 
  const [builderOpen, setBuilderOpen] = useState(false);
  const [successSnack, setSuccessSnack] = useState(null);
  const explorerRef = useRef(null);

  const handleBuilderClose = (result) => {
    setBuilderOpen(false);
    if (result?.success) {
      setSuccessSnack(result.message);
      // Refresh the endpoints list
      if (explorerRef.current?.refresh) {
        explorerRef.current.refresh();
      }
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {operatorsLoading && <CircularProgress />}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" size="small" onClick={() => setBuilderOpen(true)}>Open API Builder</Button>
      </Box>

      <EndpointExplorer
        ref={explorerRef}
        connectionId={connection?.id}
        onTryIt={handleTryIt}
        onGetCode={handleGetCode}
      />

      <Drawer anchor="right" open={builderOpen} onClose={() => setBuilderOpen(false)} PaperProps={{ sx: { width: 1000 } }}>
        {builderOpen && (
          <Builder onClose={handleBuilderClose} />
        )}
      </Drawer>

      {/* Success Snackbar */}
      <Snackbar 
        open={!!successSnack} 
        autoHideDuration={6000} 
        onClose={() => setSuccessSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessSnack(null)} severity="success" sx={{ width: '100%' }}>
          {successSnack}
        </Alert>
      </Snackbar>

      {/* Try It Panel */}
      <Drawer anchor="right" open={tryItOpen} onClose={handleCloseTryIt} PaperProps={{ sx: { width: 600 } }}>
        {tryItOpen && (
          <APITester
            operatorsMap={operators}
            selectedTable={tryItEndpoint.table}
            operation={tryItEndpoint.method}
            connectionId={connection?.id}
            endpoint={tryItEndpoint}
            open={tryItOpen}
            onClose={handleCloseTryIt}
          />
        )}
      </Drawer>

      {/* Get Code Panel
      <Drawer anchor="right" open={codeOpen} onClose={handleCloseCode} PaperProps={{ sx: { width: 600 } }}>
        {codeOpen && (
          <ImplementationSnippets
            connectionId={connection?.id}
            endpoint={codeEndpoint}
            open={codeOpen}
            onClose={handleCloseCode}
          />
        )}
      </Drawer> */}
    </Container>
  );
};

export default APIs;
