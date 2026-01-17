import { useEffect, useMemo, useState } from "react";
import { useConnection } from "../../../_shared/database/useConnection";
import { LISTENERS } from "../../../_shared/listeners";
import { 
    Avatar, 
    Box, 
    Button, 
    Dialog, 
    DialogActions, 
    DialogContent, 
    DialogTitle, 
    IconButton, 
    List, 
    ListItem, 
    ListItemAvatar, 
    ListItemText, 
    Typography,
    Chip,
    Tooltip,
    alpha,
    useTheme,
} from "@mui/material";
import { loadConnections } from "../../../utils/storage";
import StorageIcon from "@mui/icons-material/Storage";
import ConnectionForm from "./ConnectionForm";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PowerOffIcon from "@mui/icons-material/PowerOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export const Sidebar = () => {
    const theme = useTheme();
    const [openDialog, setOpenDialog] = useState(false);
    const [confirm, setConfirm] = useState({
        open: false,
        type: null,
        target: null,
    });
    const [reconnecting, setReconnecting] = useState(false);
    const {
        currentConnection,
        selectConnection,
        saveCurrentConnection,
        deleteConnection: deleteStored,
        closeConnection,
        updateSchema
    } = useConnection();
    const connections = loadConnections();

    // Listen for open connection form event
    useEffect(() => {
        const handleOpenForm = () => setOpenDialog(true);
        window.addEventListener(LISTENERS.OPEN_ADD_CONNECTION, handleOpenForm);
        return () => window.removeEventListener(LISTENERS.OPEN_ADD_CONNECTION, handleOpenForm);
    }, []);

    // Auto-introspect on browser refresh if there's a saved connection
    // Uses sessionStorage to ensure this only runs once per browser session (not on app switch)
    useEffect(() => {
        const sessionKey = 'schema_introspected';
        const alreadyIntrospected = sessionStorage.getItem(sessionKey);
        
        if (currentConnection && !reconnecting && !alreadyIntrospected) {
            // Mark as introspected for this session
            sessionStorage.setItem(sessionKey, 'true');
            
            // Trigger introspection to refresh schema on page load
            (async () => {
                setReconnecting(true);
                try {
                    const { introspectConnection, getSchema } = await import('../../../services/api');
                    await introspectConnection(currentConnection.id, {
                        host: currentConnection.host,
                        port: parseInt(currentConnection.port, 10),
                        database: currentConnection.database,
                        user: currentConnection.user,
                        password: currentConnection.password,
                        type: currentConnection.type,
                        uri: currentConnection.uri,
                        encrypt: currentConnection.encrypt,
                    });
                    const schemaData = await getSchema(currentConnection.id);
                    updateSchema(schemaData);
                } catch (err) {
                    console.error('Failed to auto-introspect on refresh:', err);
                } finally {
                    setReconnecting(false);
                }
            })();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentConnection?.id]); // Run when connection is loaded

    // Handle reconnecting to a saved connection with introspection
    const handleSelectConnection = async (connection) => {
        selectConnection(connection);
        // Auto-introspect to load schema after server restart
        setReconnecting(true);
        try {
            const { introspectConnection, getSchema } = await import('../../../services/api');
            await introspectConnection(connection.id, {
                host: connection.host,
                port: parseInt(connection.port, 10),
                database: connection.database,
                user: connection.user,
                password: connection.password,
                type: connection.type,
                uri: connection.uri,
                encrypt: connection.encrypt,
            });
            // Load schema to populate the context
            const schemaData = await getSchema(connection.id);
            updateSchema(schemaData);
        } catch (err) {
            // If introspection fails, still keep the connection selected
            // but schema will be null
            console.error('Failed to reconnect:', err);
            window.dispatchEvent(new CustomEvent('toast', { 
                detail: { 
                    message: `Failed to reconnect: ${err.response?.data?.error || err.message}`, 
                    severity: 'error' 
                } 
            }));
        } finally {
            setReconnecting(false);
        }
    };

    const getDbTypeColor = (type) => {
        if (type === 'mysql') return '#00758F';
        if (type === 'postgres' || type === 'postgresql') return '#336791';
        return theme.palette.primary.main;
    };

    return <Box
        data-tour="sidebar"
        sx={{
            width: 260,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            height: "calc(100vh - 64px)",
            position: "sticky",
            top: 64,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
        }}
    >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                    Connections
                </Typography>
                <Chip 
                    label={connections.length} 
                    size="small" 
                    sx={{ 
                        height: 20, 
                        fontSize: 11,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                    }} 
                />
            </Box>
            <Button
                variant="contained"
                fullWidth
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
                data-tour="new-connection-btn"
                sx={{
                    background: "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
                    boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
                    "&:hover": {
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.4)",
                    },
                }}
            >
                New Connection
            </Button>
        </Box>

        {/* Connections List */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 1 }}>
            {connections.length === 0 ? (
                <Box
                    sx={{
                        border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                        borderRadius: 2,
                        p: 3,
                        m: 1,
                        textAlign: "center",
                    }}
                >
                    <StorageIcon sx={{ color: "text.disabled", fontSize: 40, mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        No connections yet
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                        Add your first database
                    </Typography>
                </Box>
            ) : (
                <List dense sx={{ p: 0 }}>
                    {connections.map((c) => {
                        const isActive = currentConnection?.id === c.id;
                        const dbColor = getDbTypeColor(c.type);
                        
                        return (
                            <ListItem
                                key={c.id}
                                onClick={() => handleSelectConnection(c)}
                                secondaryAction={
                                    isActive && (
                                        <Box sx={{ display: "flex", gap: 0.5 }}>
                                            <Tooltip title="Disconnect">
                                                <IconButton 
                                                    size="small" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirm({ open: true, type: "disconnect", target: c });
                                                    }}
                                                    sx={{ 
                                                        opacity: 0.6, 
                                                        "&:hover": { opacity: 1, color: "warning.main" } 
                                                    }}
                                                >
                                                    <PowerOffIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton 
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirm({ open: true, type: "delete", target: c });
                                                    }}
                                                    sx={{ 
                                                        opacity: 0.6, 
                                                        "&:hover": { opacity: 1, color: "error.main" } 
                                                    }}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    )
                                }
                                sx={{
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    mb: 0.5,
                                    border: 1,
                                    borderColor: isActive ? "primary.main" : "transparent",
                                    bgcolor: isActive 
                                        ? alpha(theme.palette.primary.main, 0.08)
                                        : "transparent",
                                    "&:hover": { 
                                        bgcolor: isActive 
                                            ? alpha(theme.palette.primary.main, 0.12)
                                            : "action.hover",
                                    },
                                    transition: "all 0.2s ease",
                                    pr: isActive ? 10 : 2,
                                }}
                            >
                                <ListItemAvatar sx={{ minWidth: 44 }}>
                                    <Avatar 
                                        sx={{ 
                                            width: 36, 
                                            height: 36,
                                            bgcolor: alpha(dbColor, 0.15),
                                            color: dbColor,
                                        }}
                                    >
                                        <StorageIcon fontSize="small" />
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Typography 
                                                variant="body2" 
                                                fontWeight={600}
                                                sx={{ 
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {c.name || c.database || "Connection"}
                                            </Typography>
                                            {isActive && reconnecting ? (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <Box 
                                                        component="span"
                                                        sx={{ 
                                                            width: 6, 
                                                            height: 6,
                                                            borderRadius: "50%",
                                                            bgcolor: "info.main",
                                                            animation: "pulse 1.5s ease-in-out infinite"
                                                        }}
                                                    />
                                                    <Typography variant="caption" color="info.main" fontWeight={600}>
                                                        Connecting
                                                    </Typography>
                                                </Box>
                                            ) : isActive ? (
                                                <CheckCircleIcon 
                                                    sx={{ fontSize: 14, color: "success.main" }} 
                                                />
                                            ) : null}
                                        </Box>
                                    }
                                    secondary={
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                                            <Chip 
                                                label={c.type?.toUpperCase() || "DB"} 
                                                size="small"
                                                sx={{ 
                                                    height: 18, 
                                                    fontSize: 10,
                                                    fontWeight: 600,
                                                    bgcolor: alpha(dbColor, 0.1),
                                                    color: dbColor,
                                                }} 
                                            />
                                            <Typography variant="caption" color="text.disabled" noWrap>
                                                {c.host}:{c.port}
                                            </Typography>
                                        </Box>
                                    }
                                />
                            </ListItem>
                        );
                    })}
                </List>
            )}
        </Box>
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
                            } catch { }
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
}