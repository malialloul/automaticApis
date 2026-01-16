import { Box, Drawer, CircularProgress, Button, Snackbar, Alert, Paper, Typography, alpha, useTheme } from '@mui/material';
import Builder from './Builder/Builder';
import EndpointExplorer from './EndpointExplorer';
import APITester from './APIsTester/APITester';
import ApiIcon from '@mui/icons-material/Api';
import BuildIcon from '@mui/icons-material/Build';

import React, { useContext, useState, useRef } from 'react';
import { useConnection } from '../../_shared/database/useConnection';
import { useLoadOperators } from '../../_shared/database/useLoadOperators';
import { AppContext } from '../../App';

const APIs = () => {
  const theme = useTheme();
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
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ApiIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              API Explorer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Browse, test, and manage your auto-generated endpoints
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {operatorsLoading && <CircularProgress size={20} />}
          <Button 
            variant="contained" 
            startIcon={<BuildIcon />}
            onClick={() => setBuilderOpen(true)}
            data-tour="api-builder-btn"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              px: 2.5,
            }}
          >
            API Builder
          </Button>
        </Box>
      </Paper>

      <EndpointExplorer
        ref={explorerRef}
        connectionId={connection?.id}
        onTryIt={handleTryIt}
        onGetCode={handleGetCode}
      />

      <Drawer 
        anchor="right" 
        open={builderOpen} 
        onClose={() => setBuilderOpen(false)} 
        PaperProps={{ 
          sx: { 
            width: '85vw',
            maxWidth: 1400,
            minWidth: 1000,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
          } 
        }}
      >
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
        <Alert onClose={() => setSuccessSnack(null)} severity="success" sx={{ width: '100%', borderRadius: 2 }}>
          {successSnack}
        </Alert>
      </Snackbar>

      {/* Try It Panel */}
      <Drawer 
        anchor="right" 
        open={tryItOpen} 
        onClose={handleCloseTryIt} 
        PaperProps={{ 
          sx: { 
            width: 650,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
            p: 3,
          } 
        }}
      >
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
    </Box>
  );
};

export default APIs;
