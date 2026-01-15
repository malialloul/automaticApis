import { Box, Grid, Typography } from "@mui/material"
import { useConnection } from "../../../_shared/database/useConnection";

export const QuickActions = () => {
    const { currentConnection } = useConnection();

    return (
        <Grid container spacing={3} sx={{ mt: 3 }}>
            <Grid item xs={12} md={12}>
                <Typography sx={{ mb: 1.5, color: "#F1F5F9", fontWeight: 600, fontSize: 18 }}>Quick Actions</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Box onClick={() => navigate("/documentation")} sx={{ cursor: "pointer", bgcolor: "#2A2F45", background: "linear-gradient(135deg, #8B5CF6, #3B82F6)", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "transform 120ms", "&:hover": { filter: "brightness(1.1)", transform: "scale(1.02)" } }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ fontSize: 28 }}>💻</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Generate Code</Typography>
                                    <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Get client code in any language</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ fontSize: 20 }}>→</Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Box onClick={() => currentConnection && navigate("/apis")} sx={{ cursor: currentConnection ? "pointer" : "default", bgcolor: "#1E293B", border: "2px solid #8B5CF6", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: currentConnection ? 1 : 0.6 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ fontSize: 24, color: "#8B5CF6" }}>⚡</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: 16 }}>View All APIs</Typography>
                                    <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Browse generated endpoints</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ fontSize: 20 }}>→</Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Box onClick={() => currentConnection && navigate("/documentation")} sx={{ cursor: currentConnection ? "pointer" : "default", bgcolor: "#1E293B", border: "2px solid #3B82F6", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: currentConnection ? 1 : 0.6 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ fontSize: 24, color: "#3B82F6" }}>📄</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Export Swagger</Typography>
                                    <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Download OpenAPI specification</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ fontSize: 20 }}>→</Box>
                        </Box>
                    </Grid>
                    <Grid item xs={12}>
                        <Box onClick={() => navigate("/schema")} sx={{ cursor: "pointer", bgcolor: "#1E293B", border: "2px solid #10B981", borderRadius: 3, p: 2.5, height: 100, color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ fontSize: 24, color: "#10B981" }}>🗺️</Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: 16 }}>View ER Diagram</Typography>
                                    <Typography sx={{ fontSize: 13, opacity: 0.8 }}>Visualize relationships</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ fontSize: 20 }}>→</Box>
                        </Box>
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
    )
}