import { Box, Grid, Typography, Skeleton } from "@mui/material"
import TableChartIcon from "@mui/icons-material/TableChart";
import StorageIcon from "@mui/icons-material/Storage";
import LinkIcon from "@mui/icons-material/Link";
import ApiIcon from "@mui/icons-material/Api";

export const KeyMetrics = ({ displayStats, loadingStats, }) => {
    return (
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                    <TableChartIcon sx={{ fontSize: 24, color: "#3B82F6" }} />
                    <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Tables</Typography>
                    {displayStats ? (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.tableCount}</Typography>
                    ) : loadingStats ? (
                        <Skeleton variant="text" width={80} height={48} />
                    ) : (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                    )}
                </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                    <StorageIcon sx={{ fontSize: 24, color: "#8B5CF6" }} />
                    <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Total Columns</Typography>
                    {displayStats ? (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.columnCount ?? '–'}</Typography>
                    ) : loadingStats ? (
                        <Skeleton variant="text" width={80} height={48} />
                    ) : (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                    )}
                </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                    <LinkIcon sx={{ fontSize: 24, color: "#10B981" }} />
                    <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>Relationships</Typography>
                    {displayStats ? (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.relationshipCount}</Typography>
                    ) : loadingStats ? (
                        <Skeleton variant="text" width={80} height={48} />
                    ) : (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                    )}
                </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ bgcolor: "#1E293B", border: "1px solid #334155", borderRadius: 3, p: 3, height: 140 }}>
                    <ApiIcon sx={{ fontSize: 24, color: "#F59E0B" }} />
                    <Typography sx={{ color: "#94A3B8", fontSize: 14, fontWeight: 500 }}>API Endpoints</Typography>
                    {displayStats ? (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{displayStats.endpointCount}</Typography>
                    ) : loadingStats ? (
                        <Skeleton variant="text" width={80} height={48} />
                    ) : (
                        <Typography sx={{ color: "#F1F5F9", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>–</Typography>
                    )}
                </Box>
            </Grid>
        </Grid>
    )
}