import { Box, Button, Chip, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material"
import StorageIcon from "@mui/icons-material/Storage";
import { useConnection } from "../../../_shared/database/useConnection";

export const Header = ({ scope, setScope }) => {
    const { currentConnection, selectConnection } = useConnection();

    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 700, color: "#F1F5F9" }}>Dashboard</Typography>
                {currentConnection && (
                    <Chip
                        label={`Viewing: ${currentConnection.name || currentConnection.database}`}
                        icon={<StorageIcon sx={{ color: "white !important" }} />}
                        onDelete={() => selectConnection(null)}
                        sx={{ bgcolor: "#8B5CF6", color: "white" }}
                    />
                )}
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: 'center' }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={scope || (currentConnection ? 'current' : 'all')}
                    onChange={(_, val) => val && setScope(val)}
                    color="primary"
                >
                    <ToggleButton value="current" disabled={!currentConnection}>Current</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                </ToggleButtonGroup>
            </Box>
        </Box>
    )
}