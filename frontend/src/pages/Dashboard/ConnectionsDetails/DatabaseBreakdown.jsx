import { 
    Box, 
    Typography, 
    Skeleton, 
    Tooltip, 
    IconButton, 
    Chip,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    alpha,
    useTheme,
    Paper,
} from "@mui/material"
import PowerOffIcon from "@mui/icons-material/PowerOff";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TableChartIcon from "@mui/icons-material/TableChart";
import ApiIcon from "@mui/icons-material/Api";
import { useConnection } from "../../../_shared/database/useConnection";
import { useNavigate } from "react-router-dom";

export const DatabaseBreakdown = ({ refreshSchemas, connections, scope, statsById, loadingStats, setConfirm }) => {
    const theme = useTheme();
    const { currentConnection, selectConnection } = useConnection();
    const navigate = useNavigate();

    const getDbTypeColor = (type) => {
        if (type === 'mysql') return '#00758F';
        if (type === 'postgres' || type === 'postgresql') return '#336791';
        return theme.palette.primary.main;
    };

    const filteredConnections = scope === 'current' && currentConnection
        ? connections.filter((c) => c.id === currentConnection.id)
        : connections.slice().sort((a, b) => {
            if (!currentConnection?.id) return 0;
            const aIsCurrent = a.id === currentConnection.id;
            const bIsCurrent = b.id === currentConnection.id;
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return 0;
        });

    return (
        <Paper 
            variant="outlined" 
            sx={{ 
                borderRadius: 3, 
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Header */}
            <Box sx={{ 
                p: 2, 
                borderBottom: 1, 
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                        {scope === 'all' ? 'All Databases' : 'Current Database'}
                    </Typography>
                    <Chip 
                        label={filteredConnections.length} 
                        size="small" 
                        sx={{ 
                            height: 20, 
                            fontSize: 11,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: "primary.main",
                        }} 
                    />
                </Box>
            </Box>

            {/* List */}
            <Box sx={{ flex: 1, overflow: "auto" }}>
                {connections.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                        <StorageIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                        <Typography color="text.secondary">No connections yet</Typography>
                        <Typography variant="caption" color="text.disabled">
                            Add a database to get started
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ p: 1 }}>
                        {filteredConnections.map((c) => {
                            const isActive = currentConnection?.id === c.id;
                            const dbColor = getDbTypeColor(c.type);
                            const stats = statsById[c.id];

                            return (
                                <ListItem
                                    key={c.id}
                                    onClick={() => selectConnection(c)}
                                    sx={{
                                        borderRadius: 2,
                                        cursor: "pointer",
                                        mb: 1,
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
                                    }}
                                    secondaryAction={
                                        <Box sx={{ display: "flex", gap: 0.5 }}>
                                            <Tooltip title="Refresh Schema">
                                                <IconButton 
                                                    size="small" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        refreshSchemas([c.id]);
                                                    }}
                                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "primary.main" } }}
                                                >
                                                    <RefreshIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="View Schema">
                                                <IconButton 
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectConnection(c);
                                                        navigate("/schema");
                                                    }}
                                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "info.main" } }}
                                                >
                                                    <VisibilityIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Disconnect">
                                                <IconButton 
                                                    size="small" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirm({ open: true, type: "disconnect", target: c });
                                                    }}
                                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "warning.main" } }}
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
                                                    sx={{ opacity: 0.6, "&:hover": { opacity: 1, color: "error.main" } }}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    }
                                >
                                    <ListItemAvatar>
                                        <Avatar 
                                            sx={{ 
                                                bgcolor: alpha(dbColor, 0.15),
                                                color: dbColor,
                                            }}
                                        >
                                            <StorageIcon />
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography variant="body1" fontWeight={600}>
                                                    {c.name || c.database}
                                                </Typography>
                                                {isActive && (
                                                    <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5 }}>
                                                <Chip 
                                                    label={c.type?.toUpperCase() || "DB"} 
                                                    size="small"
                                                    sx={{ 
                                                        height: 20, 
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        bgcolor: alpha(dbColor, 0.1),
                                                        color: dbColor,
                                                    }} 
                                                />
                                                <Typography variant="caption" color="text.disabled">
                                                    {c.host}:{c.port}
                                                </Typography>
                                                {stats && (
                                                    <>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <TableChartIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {stats.tableCount}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <ApiIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                                            <Typography variant="caption" color="text.secondary">
                                                                {stats.endpointCount}
                                                            </Typography>
                                                        </Box>
                                                    </>
                                                )}
                                                {!stats && !loadingStats && (
                                                    <Typography variant="caption" color="text.disabled">
                                                        Click refresh to load stats
                                                    </Typography>
                                                )}
                                                {loadingStats && !stats && (
                                                    <Skeleton variant="text" width={60} height={16} />
                                                )}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>
        </Paper>
    )
}