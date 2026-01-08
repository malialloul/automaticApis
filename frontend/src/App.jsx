import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  Container,
  Chip,
} from '@mui/material';
import { useConnection } from './hooks/useConnection';
import Home from './pages/Home';
import Schema from './pages/Schema';
import APIs from './pages/APIs';
import Documentation from './pages/Documentation';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const queryClient = new QueryClient();

function Navigation({ currentConnection }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { label: 'Home', path: '/' },
    { label: 'Schema', path: '/schema' },
    { label: 'APIs', path: '/apis' },
    { label: 'Documentation', path: '/documentation' },
  ];

  const currentTab = tabs.findIndex(tab => tab.path === currentPath);

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ mr: 4, fontWeight: 'bold' }}
          >
            🚀 Automatic APIs
          </Typography>

          <Box sx={{ flexGrow: 1 }}>
            <Tabs 
              value={currentTab >= 0 ? currentTab : 0} 
              textColor="inherit"
              indicatorColor="secondary"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.path}
                  label={tab.label}
                  component={Link}
                  to={tab.path}
                />
              ))}
            </Tabs>
          </Box>

          {currentConnection && (
            <Chip
              label={`Connected: ${currentConnection.database}`}
              color="success"
              variant="outlined"
              sx={{ 
                color: 'white',
                borderColor: 'white',
              }}
            />
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

function AppContent() {
  const {
    currentConnection,
    selectConnection,
    saveCurrentConnection,
    deleteConnection,
    updateSchema,
  } = useConnection();

  const handleConnectionSaved = (connection) => {
    saveCurrentConnection(connection);
  };

  const handleSchemaLoaded = (schemaData) => {
    if (schemaData) {
      updateSchema(schemaData);
    }
  };

  return (
    <>
      <Navigation currentConnection={currentConnection} />
      <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: 'grey.100' }}>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                connection={currentConnection}
                onConnectionSaved={handleConnectionSaved}
                onConnectionSelect={selectConnection}
                onConnectionDelete={deleteConnection}
                onSchemaLoaded={handleSchemaLoaded}
              />
            }
          />
          <Route
            path="/schema"
            element={<Schema connection={currentConnection} />}
          />
          <Route
            path="/apis"
            element={<APIs connection={currentConnection} />}
          />
          <Route
            path="/documentation"
            element={<Documentation connection={currentConnection} />}
          />
        </Routes>
      </Box>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AppContent />
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
