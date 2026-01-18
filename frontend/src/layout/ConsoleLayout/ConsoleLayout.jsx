import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { ConsoleLayoutBar } from "./Appbar";
import { Sidebar } from "./Sidebar/Sidebar";
import { AppContext } from "../../App";
import { useConnection } from "../../_shared/database/useConnection";
import { NoConnections } from "./NoConnections";

// Pages that can be accessed without a database connection
const NO_CONNECTION_PAGES = ['/schema-builder', '/dashboard'];

export default function ConsoleLayout({ children, darkMode, setDarkMode }) {
  const {
    currentConnection,
  } = useConnection();
  const { schema, isLoadingSchema, schemaError } = useContext(AppContext);
  const location = useLocation();

  // Check if current page can be accessed without a connection
  const allowWithoutConnection = NO_CONNECTION_PAGES.some(page => location.pathname.startsWith(page));

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    const toastHandler = (e) => {
      const { message, severity } = e.detail || {};
      setToast({
        open: true,
        message: message || "Done",
        severity: severity || "success",
      });
    };
    window.addEventListener("toast", toastHandler);
    return () => {
      window.removeEventListener("toast", toastHandler);
    };
  }, []);

  return (
    <Box>
      <ConsoleLayoutBar darkMode={darkMode} setDarkMode={setDarkMode} />

      <Box sx={{ display: "flex", pt: 8 }}>
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {
            isLoadingSchema ? <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box> : schemaError && !allowWithoutConnection ? <Alert severity="error">{schemaError}</Alert> : !currentConnection && !allowWithoutConnection ? <NoConnections /> : children
          }

        </Box>
      </Box>
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
