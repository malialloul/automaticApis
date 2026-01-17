import { Box, Button, Chip, IconButton, ToggleButton, ToggleButtonGroup, Typography, alpha, useTheme } from "@mui/material"
import StorageIcon from "@mui/icons-material/Storage";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useConnection } from "../../../_shared/database/useConnection";

export const Header = ({ scope, setScope, refreshSchemas }) => {
    const theme = useTheme();
    const { currentConnection, selectConnection } = useConnection();

    return (
        <Box 
            sx={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                p: 2,
                borderRadius: 3,
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <StorageIcon sx={{ color: "white", fontSize: 24 }} />
                </Box>
                <Box>
                    <Typography variant="h5" fontWeight={700}>
                        Dashboard
                    </Typography>
                    {currentConnection ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main" }} />
                            <Typography variant="body2" color="text.secondary">
                                Connected to <b>{currentConnection.name || currentConnection.database}</b>
                            </Typography>
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Overview of all your databases
                        </Typography>
                    )}
                </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: 'center' }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={scope || (currentConnection ? 'current' : 'all')}
                    onChange={(_, val) => val && setScope(val)}
                    sx={{
                        '& .MuiToggleButton-root': {
                            px: 2,
                            borderColor: "divider",
                            '&.Mui-selected': {
                                bgcolor: alpha(theme.palette.primary.main, 0.15),
                                color: "primary.main",
                                borderColor: "primary.main",
                            }
                        }
                    }}
                >
                    <ToggleButton value="current" disabled={!currentConnection}>Current</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                </ToggleButtonGroup>
                <IconButton 
                    onClick={() => refreshSchemas()}
                    sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                    }}
                >
                    <RefreshIcon sx={{ color: "primary.main" }} />
                </IconButton>
            </Box>
        </Box>
    )
}