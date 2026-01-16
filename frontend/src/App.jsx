import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import {
  CssBaseline,
  ThemeProvider,
} from "@mui/material";
import { useConnection } from "./_shared/database/useConnection";
import Home from "./pages/Home";
import { createAppTheme } from "./styles/theme";
import Navigation from "./layout/Navigation";
import ConsoleLayout from "./layout/ConsoleLayout/ConsoleLayout";
import { PortalRoutes, PortalRoutesPaths } from "./routes/portal.routes";
import { useLoadSchema } from "./_shared/database/useLoadSchema";
import { TourProvider } from "./_shared/tour/TourProvider";

export const AppContext = React.createContext({ schema: null, refreshSchema: null, isLoadingSchema: false, schemaError: null });

function AppContent() {
  const [darkMode, setDarkMode] = useState(true);
  const appTheme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  const location = useLocation();
  const isConsoleRoute = Object.entries(PortalRoutesPaths).some(([, path]) => location.pathname.startsWith(path));

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <TourProvider>
        {!isConsoleRoute && (
          <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
        )}
        {isConsoleRoute ? (
          <ConsoleLayout darkMode={darkMode} setDarkMode={setDarkMode}>
            <PortalRoutes />
          </ConsoleLayout>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        )}
      </TourProvider>
    </ThemeProvider>
  );
}

function App() {
  const {
    currentConnection,
  } = useConnection();
  const { data: schema, isLoading, error, refetch: refreshSchema } = useLoadSchema({ connectionId: currentConnection?.id });
  return (
    <AppContext.Provider value={{ schema, refreshSchema, isLoadingSchema: isLoading, schemaError: error }}>
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
}

export default App;
