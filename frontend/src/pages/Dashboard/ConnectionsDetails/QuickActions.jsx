import { 
    Box, 
    Typography, 
    Paper,
    alpha,
    useTheme,
    Stack,
} from "@mui/material"
import { useConnection } from "../../../_shared/database/useConnection";
import { useNavigate } from "react-router-dom";
import ApiIcon from "@mui/icons-material/Api";
import TableChartIcon from "@mui/icons-material/TableChart";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

export const QuickActions = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { currentConnection } = useConnection();

    const actions = [
        {
            icon: <ApiIcon />,
            label: "View APIs",
            description: "Browse & test endpoints",
            color: "#8B5CF6",
            onClick: () => currentConnection && navigate("/db-apis"),
            disabled: !currentConnection,
        },
        {
            icon: <TableChartIcon />,
            label: "Schema Browser",
            description: "Explore tables & columns",
            color: "#3B82F6",
            onClick: () => currentConnection && navigate("/schema"),
            disabled: !currentConnection,
        },
        {
            icon: <AccountTreeIcon />,
            label: "ER Diagram",
            description: "Visualize relationships",
            color: "#10B981",
            onClick: () => currentConnection && navigate("/er-diagram"),
            disabled: !currentConnection,
        },
    ];

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
            data-tour="quick-actions"
        >
            {/* Header */}
            <Box sx={{ 
                p: 2, 
                borderBottom: 1, 
                borderColor: "divider",
            }}>
                <Typography variant="subtitle1" fontWeight={600}>
                    Quick Actions
                </Typography>
            </Box>

            {/* Actions List */}
            <Stack spacing={1.5} sx={{ p: 2, flex: 1 }}>
                {actions.map((action, index) => (
                    <Box
                        key={index}
                        onClick={action.disabled ? undefined : action.onClick}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 2,
                            borderRadius: 2,
                            cursor: action.disabled ? "not-allowed" : "pointer",
                            opacity: action.disabled ? 0.5 : 1,
                            border: 1,
                            borderColor: alpha(action.color, 0.3),
                            bgcolor: alpha(action.color, 0.05),
                            transition: "all 0.2s ease",
                            "&:hover": action.disabled ? {} : {
                                bgcolor: alpha(action.color, 0.1),
                                borderColor: action.color,
                                transform: "translateX(4px)",
                            },
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box 
                                sx={{ 
                                    p: 1,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(action.color, 0.15),
                                    color: action.color,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {action.icon}
                            </Box>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>
                                    {action.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {action.description}
                                </Typography>
                            </Box>
                        </Box>
                        <ArrowForwardIcon 
                            sx={{ 
                                fontSize: 18, 
                                color: action.color,
                                opacity: 0.6,
                            }} 
                        />
                    </Box>
                ))}
            </Stack>
        </Paper>
    )
}