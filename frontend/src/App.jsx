import React, { useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
} from "@mui/material";
import { useConnection } from "./hooks/useConnection";
import Home from "./pages/Home";
import Schema from "./pages/Schema";
import APIs from "./pages/APIs";
import Documentation from "./pages/Documentation";
import Pricing from "./pages/Pricing";
// Removed Login/Signup and auth
import Contact from "./pages/Contact";
import DashboardPage from "./pages/Dashboard";
import { createAppTheme } from "./styles/theme";
import Navigation from "./components/Navigation";
import ConsoleLayout from "./components/ConsoleLayout";

const queryClient = new QueryClient();

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
  const [darkMode, setDarkMode] = useState(true);
  const appTheme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  const location = useLocation();
  const isConsoleRoute = [
    "/dashboard",
    "/schema",
    "/apis",
    "/documentation",
  ].some((p) => location.pathname.startsWith(p));

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      {!isConsoleRoute && (
        <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
      )}
      {isConsoleRoute ? (
        <ConsoleLayout darkMode={darkMode} setDarkMode={setDarkMode}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/schema"
              element={<Schema connection={currentConnection} />}
            />
            <Route
              path="/apis"
              element={
                currentConnection ? (
                  <APIs connection={currentConnection} />
                ) : (
                  <Navigate
                    to="/dashboard"
                    replace
                    state={{ notice: "Connect to a database to access APIs." }}
                  />
                )
              }
            />
            <Route
              path="/documentation"
              element={
                currentConnection ? (
                  <Documentation connection={currentConnection} />
                ) : (
                  <Navigate
                    to="/dashboard"
                    replace
                    state={{ notice: "Connect to a database to view Docs." }}
                  />
                )
              }
            />
          </Routes>
        </ConsoleLayout>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      )}
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
