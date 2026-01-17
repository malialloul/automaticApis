import { Box, Grid, Paper, Typography, alpha, useTheme, Stack } from "@mui/material"
import { DatabaseBreakdown } from "./DatabaseBreakdown"
import { Header } from "./Header"
import { KeyMetrics } from "./KeyMetrics"
import { QuickActions } from "./QuickActions"
import StorageIcon from "@mui/icons-material/Storage";
import ApiIcon from "@mui/icons-material/Api";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BoltIcon from "@mui/icons-material/Bolt";

const GettingStartedCard = () => {
    const theme = useTheme();
    
    const steps = [
        { icon: <StorageIcon sx={{ fontSize: 18 }} />, text: "Connect your database", color: "#3B82F6" },
        { icon: <BoltIcon sx={{ fontSize: 18 }} />, text: "Auto-generate REST APIs", color: "#8B5CF6" },
        { icon: <ApiIcon sx={{ fontSize: 18 }} />, text: "Test & integrate instantly", color: "#10B981" },
    ];
    
    return (
        <Paper 
            variant="outlined" 
            sx={{ 
                borderRadius: 3, 
                overflow: "hidden",
                background: `linear-gradient(135deg, ${alpha('#8b5cf6', 0.05)} 0%, ${alpha('#3b82f6', 0.05)} 100%)`,
            }}
        >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="subtitle1" fontWeight={600}>How It Works</Typography>
            </Box>
            <Stack spacing={2} sx={{ p: 2 }}>
                {steps.map((step, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                bgcolor: alpha(step.color, 0.15),
                                color: step.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 14,
                            }}
                        >
                            {step.icon}
                        </Box>
                        <Typography variant="body2" fontWeight={500}>{step.text}</Typography>
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
};

const TipsCard = () => {
    const theme = useTheme();
    
    const tips = [
        "APIs support filtering, sorting & pagination",
        "Foreign keys auto-generate nested endpoints",
        "Schema changes? Hit refresh to regenerate",
    ];
    
    return (
        <Paper 
            variant="outlined" 
            sx={{ 
                borderRadius: 3, 
                overflow: "hidden",
            }}
        >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="subtitle1" fontWeight={600}>💡 Pro Tips</Typography>
            </Box>
            <Stack spacing={1.5} sx={{ p: 2 }}>
                {tips.map((tip, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                                mt: 0.8,
                                flexShrink: 0,
                            }}
                        />
                        <Typography variant="body2" color="text.secondary">{tip}</Typography>
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
};

export const ConnectionsDetails = ({ refreshSchemas, connections, scope, setScope, displayStats, loadingStats, statsById, setConfirm }) => {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Header scope={scope} setScope={setScope} refreshSchemas={refreshSchemas} />
            <KeyMetrics displayStats={displayStats} loadingStats={loadingStats} />
            <Grid container spacing={2}>
                <Grid item xs={12} lg={8}>
                    <DatabaseBreakdown 
                        refreshSchemas={refreshSchemas} 
                        connections={connections} 
                        scope={scope} 
                        statsById={statsById} 
                        loadingStats={loadingStats} 
                        setConfirm={setConfirm} 
                    />
                </Grid>
                <Grid item xs={12} lg={4}>
                    <Stack spacing={2}>
                        <QuickActions />
                        <GettingStartedCard />
                        <TipsCard />
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    )
}