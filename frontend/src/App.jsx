import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
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
  IconButton,
  Avatar,
  Badge,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import { useConnection } from './hooks/useConnection';
import Home from './pages/Home';
import Schema from './pages/Schema';
import APIs from './pages/APIs';
import Documentation from './pages/Documentation';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import { useAuth } from './hooks/useAuth';
import Console from './pages/Console';
import Contact from './pages/Contact';

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
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const handleMenu = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const tabs = [
    { label: 'Home', path: '/' },
    { label: 'Schema', path: '/schema' },
    { label: 'APIs', path: '/apis' },
    { label: 'Documentation', path: '/documentation' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Contact', path: '/contact' },
  ];

  const currentTab = tabs.findIndex(tab => tab.path === currentPath);

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 3 }}>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 800 }}>Automatic APIs</Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Tabs 
              value={currentTab >= 0 ? currentTab : 0} 
              textColor="inherit"
              indicatorColor="secondary"
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.path}
                  label={tab.label}
                  component={Link}
                  to={tab.path}
                  sx={{ minWidth: { xs: 80, md: 120 }, fontWeight: currentPath === tab.path ? 700 : 500 }}
                />
              ))}
            </Tabs>
          </Box>

          <Box sx={{ ml: 2 }}>
            {user ? (
              <>
                <Tooltip title={currentConnection ? `Connected: ${currentConnection.database}` : 'Account'}>
                  <IconButton onClick={handleMenu} size="small" sx={{ ml: 2 }}>
                    <Badge invisible={!currentConnection} color="success" variant="dot" overlap="circular">
                      <Avatar sx={{ width: 32, height: 32 }}>{user.name?.[0] || 'U'}</Avatar>
                    </Badge>
                  </IconButton>
                </Tooltip>
                <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
                  <MenuItem disabled>{user.email || user.name}</MenuItem>
                  <MenuItem component={Link} to="/console" onClick={handleClose}>Developer Console</MenuItem>
                  <MenuItem onClick={() => { handleClose(); logout(); }}>Logout</MenuItem>
                </Menu>
              </>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tab label="Log In" component={Link} to="/login" />
                <Tab label="Sign Up" component={Link} to="/signup" />
              </Box>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

function AppContent() {
  const { user } = useAuth();
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
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/console"
            element={
              // Protected route: requires login
              user ? (
                <Console
                  connection={currentConnection}
                  onConnectionSaved={handleConnectionSaved}
                  onConnectionSelect={selectConnection}
                  onConnectionDelete={deleteConnection}
                  onSchemaLoaded={handleSchemaLoaded}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
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
