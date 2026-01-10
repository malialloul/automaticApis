import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  IconButton,
  Tooltip,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from "@mui/material";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import StorageIcon from "@mui/icons-material/Storage";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useLocation, useNavigate } from "react-router-dom";
import { useConnection } from "../hooks/useConnection";
import { loadConnections } from "../utils/storage";
import ConnectionForm from "../components/ConnectionForm";
import { closeConnection } from "../services/api";

export default function ConsoleLayout({ children, darkMode, setDarkMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentConnection,
    selectConnection,
    deleteConnection: deleteStored,
    saveCurrentConnection,
  } = useConnection();
  const [connections, setConnections] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [confirm, setConfirm] = useState({
    open: false,
    type: null,
    target: null,
  });
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    const refresh = () => setConnections(loadConnections());
    refresh();
    window.addEventListener("connections-changed", refresh);
    const openHandler = () => setOpenDialog(true);
    window.addEventListener("open-add-connection", openHandler);
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
      window.removeEventListener("connections-changed", refresh);
      window.removeEventListener("open-add-connection", openHandler);
      window.removeEventListener("toast", toastHandler);
    };
  }, []);

  const tabs = useMemo(
    () => [
      { label: "Dashboard", path: "/dashboard", disabled: false },
      { label: "Schema", path: "/schema", disabled: !currentConnection },
      {
        label: "ER Diagram",
        path: "/er-diagram",
        disabled: !currentConnection,
      },

      { label: "APIs", path: "/apis", disabled: !currentConnection },
      { label: "Docs", path: "/documentation", disabled: !currentConnection },
    ],
    [currentConnection]
  );

  const currentIndex = tabs.findIndex((t) =>
    location.pathname.startsWith(t.path)
  );

  return (
    <Box>
      <AppBar position="fixed" color="default" sx={{ boxShadow: 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <Tabs
            value={currentIndex === -1 ? 0 : currentIndex}
            onChange={(_, idx) =>
              !tabs[idx].disabled && navigate(tabs[idx].path)
            }
            sx={{ minHeight: 48, height: 48 }}
          >
            {tabs.map((t) => {
              const tabEl = (
                <Tab
                  key={t.path}
                  label={t.label}
                  disabled={t.disabled}
                  sx={{ minHeight: 48, height: 48 }}
                />
              );
              return t.disabled ? (
                <Tooltip
                  key={t.path}
                  title="Connect a database first to access this feature"
                >
                  <span>{tabEl}</span>
                </Tooltip>
              ) : (
                tabEl
              );
            })}
          </Tabs>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder="Search (Ctrl/Cmd + K)"
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }}
          />
          <Button variant="outlined">Upgrade</Button>
          <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", pt: 8 }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: 240,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            p: 2,
            height: "calc(100vh - 64px)",
            position: "sticky",
            top: 64,
            overflowY: "auto",
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Active Connections
          </Typography>
          <List dense>
            {connections.length === 0 ? (
              <Box
                sx={{
                  border: "2px dashed #475569",
                  borderRadius: 2,
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 120,
                  color: "text.secondary",
                }}
              >
                <Box sx={{ textAlign: "center" }}>
                  <StorageIcon sx={{ color: "#64748B", fontSize: 32 }} />
                  <Typography variant="caption">No connections</Typography>
                </Box>
              </Box>
            ) : (
              connections.map((c) => (
                <ListItem
                  key={c.id}
                  onClick={() => selectConnection(c)}
                  sx={{
                    borderRadius: 1,
                    cursor: "pointer",
                    bgcolor:
                      currentConnection?.id === c.id
                        ? "action.selected"
                        : "unset",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: "primary.main" }}>
                      <StorageIcon fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={c.name || c.database || "Connection"}
                    secondary={
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            bgcolor: "success.main",
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {c.host}:{c.port}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{
              mt: 1,
              background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
              "&:hover": {
                transform: "scale(1.02)",
                boxShadow: "0 6px 16px rgba(139, 92, 246, 0.4)",
              },
            }}
          >
            + New Connection
          </Button>
          <Dialog
            open={openDialog}
            onClose={() => setOpenDialog(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>Add Connection</DialogTitle>
            <DialogContent dividers>
              <ConnectionForm
                onConnectionSaved={(conn) => {
                  saveCurrentConnection(conn);
                  window.dispatchEvent(new CustomEvent("connections-changed"));
                  selectConnection(conn);
                  setOpenDialog(false);
                  window.dispatchEvent(
                    new CustomEvent("toast", {
                      detail: {
                        message: "Database connected successfully",
                        severity: "success",
                      },
                    })
                  );
                }}
                onSchemaLoaded={() => {
                  // backend introspection done; nothing else required
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Close</Button>
            </DialogActions>
          </Dialog>
          <Dialog
            open={confirm.open}
            onClose={() =>
              setConfirm({ open: false, type: null, target: null })
            }
          >
            <DialogTitle>
              {confirm.type === "delete"
                ? "Delete Connection"
                : "Disconnect Connection"}
            </DialogTitle>
            <DialogContent>
              <Typography>
                {currentConnection?.id === confirm.target?.id
                  ? "You are currently connected to this database. Are you sure?"
                  : confirm.type === "delete"
                  ? "This will remove the saved connection locally."
                  : "This will close the backend session."}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() =>
                  setConfirm({ open: false, type: null, target: null })
                }
              >
                Cancel
              </Button>
              <Button
                color="error"
                onClick={async () => {
                  const target = confirm.target;
                  const type = confirm.type;
                  setConfirm({ open: false, type: null, target: null });
                  if (!target) return;
                  if (type === "delete") {
                    deleteStored(target.id);
                    window.dispatchEvent(
                      new CustomEvent("toast", {
                        detail: {
                          message: "Connection deleted",
                          severity: "success",
                        },
                      })
                    );
                  } else if (type === "disconnect") {
                    try {
                      await closeConnection(target.id);
                    } catch {}
                    window.dispatchEvent(
                      new CustomEvent("connections-changed")
                    );
                    window.dispatchEvent(
                      new CustomEvent("toast", {
                        detail: {
                          message: "Disconnected from database",
                          severity: "success",
                        },
                      })
                    );
                  }
                  if (currentConnection?.id === target.id) {
                    selectConnection(null);
                  }
                }}
              >
                Confirm
              </Button>
            </DialogActions>
          </Dialog>
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, p: 3 }}>{children}</Box>
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
