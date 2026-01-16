import { Box, Grid, Typography, Skeleton, alpha, useTheme } from "@mui/material"
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ApiIcon from "@mui/icons-material/Api";

const MetricCard = ({ icon: Icon, label, value, color, loading }) => {
    const theme = useTheme();
    
    return (
        <Box 
            sx={{ 
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                borderRadius: 3, 
                p: 2.5,
                display: "flex",
                alignItems: "center",
                gap: 2,
                transition: "all 0.2s ease",
                "&:hover": {
                    borderColor: color,
                    boxShadow: `0 4px 20px ${alpha(color, 0.15)}`,
                }
            }}
        >
            <Box
                sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    bgcolor: alpha(color, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 26, color: color }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary" fontWeight={500} noWrap>
                    {label}
                </Typography>
                {loading ? (
                    <Skeleton variant="text" width={60} height={40} />
                ) : (
                    <Typography variant="h4" fontWeight={700} sx={{ color: color }}>
                        {value ?? '—'}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export const KeyMetrics = ({ displayStats, loadingStats }) => {
    const metrics = [
        { icon: TableChartIcon, label: "Tables", value: displayStats?.tableCount, color: "#3B82F6" },
        { icon: ViewColumnIcon, label: "Columns", value: displayStats?.columnCount, color: "#8B5CF6" },
        { icon: AccountTreeIcon, label: "Relations", value: displayStats?.relationshipCount, color: "#10B981" },
        { icon: ApiIcon, label: "Endpoints", value: displayStats?.endpointCount, color: "#F59E0B" },
    ];

    return (
        <Grid container spacing={2}>
            {metrics.map((metric, idx) => (
                <Grid item xs={6} sm={6} md={3} key={idx}>
                    <MetricCard 
                        icon={metric.icon}
                        label={metric.label}
                        value={metric.value}
                        color={metric.color}
                        loading={loadingStats && !displayStats}
                    />
                </Grid>
            ))}
        </Grid>
    )
}