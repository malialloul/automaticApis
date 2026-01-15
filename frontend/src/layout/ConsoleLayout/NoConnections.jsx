import { Box, Button, Grid, Typography } from "@mui/material";
import { LISTENERS } from "../../_shared/listeners";
import AddIcon from "@mui/icons-material/Add";

export const NoConnections = () => {
    return (
        <Box
            sx={{
                bgcolor: "#0F172A",
                p: 6,
                minHeight: "calc(100vh - 64px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Box sx={{ maxWidth: 800, textAlign: "center" }}>
                {/* Illustration */}
                <Box
                    sx={{
                        width: 180,
                        height: 140,
                        mx: "auto",
                        opacity: 0.6,
                        position: "relative",
                        "& > div": { position: "absolute", borderRadius: 2 },
                    }}
                >
                    <Box sx={{ top: 0, left: 0, width: 100, height: 60, border: "2px dashed #475569" }} />
                    <Box sx={{ top: 10, right: 0, width: 80, height: 40, border: "2px dashed #8B5CF6" }} />
                    <Box sx={{ bottom: 0, left: 40, width: 120, height: 60, border: "2px dashed #475569" }} />
                    <Box sx={{ bottom: 10, left: 10, width: 40, height: 20, border: "2px dashed #8B5CF6" }} />
                </Box>

                {/* Heading */}
                <Typography sx={{ mt: 3, color: "#F1F5F9", fontWeight: 600, fontSize: 28 }}>
                    No connections yet
                </Typography>
                {/* Subtext */}
                <Typography sx={{ mt: 1.5, color: "#94A3B8", maxWidth: 480, mx: "auto", lineHeight: 1.6, fontSize: 16 }}>
                    Connect to your first database to see analytics, tables, and generated APIs here
                </Typography>

                {/* Subheading */}
                <Typography sx={{ mt: 6, mb: 3, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500, fontSize: 14 }}>
                    Once connected, you'll see:
                </Typography>

                {/* Preview Grid */}
                <Grid container spacing={2}>
                    {[
                        { icon: "📊", label: "Database Stats", text: "3 databases, 47 tables" },
                        { icon: "⚡", label: "Generated APIs", text: "235 endpoints ready" },
                        { icon: "⏱️", label: "Recent Activity", text: "Your latest actions" },
                    ].map((card, idx) => (
                        <Grid key={idx} item xs={12} sm={6} md={4}>
                            <Box sx={{ bgcolor: "#1E293B", border: "1px dashed #334155", borderRadius: 3, p: 2.5, opacity: 0.7, textAlign: "left" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Box sx={{ fontSize: 20 }}>{card.icon}</Box>
                                    <Typography sx={{ color: "#94A3B8", fontWeight: 500, fontSize: 12 }}>{card.label}</Typography>
                                </Box>
                                <Typography sx={{ mt: 1, color: "#64748B", fontSize: 14 }}>{card.text}</Typography>
                                <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                                    <Box sx={{ width: 24, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                                    <Box sx={{ width: 16, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                                    <Box sx={{ width: 32, height: 10, bgcolor: "#475569", borderRadius: 1 }} />
                                </Box>
                            </Box>
                        </Grid>
                    ))}
                </Grid>

                {/* Quick Start Guide */}
                <Box sx={{ mt: 6, mx: "auto", maxWidth: 600, bgcolor: "#1E293B", borderLeft: "3px solid #8B5CF6", borderRadius: 2, p: 3, textAlign: "left" }}>
                    <Typography sx={{ color: "#F1F5F9", fontWeight: 600, fontSize: 18 }}>🚀 Quick Start Guide</Typography>
                    <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
                        {[
                            "Click '+ Connect Database' above",
                            "Enter your database credentials (stored locally in your browser)",
                            "We'll introspect your schema and generate APIs automatically",
                            "Start exploring your data, APIs, and documentation",
                        ].map((step, idx) => (
                            <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                                <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#8B5CF6", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                                    {idx + 1}
                                </Box>
                                <Typography sx={{ color: "#CBD5E1", fontSize: 14 }}>{step}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Feature Highlights */}
                <Box sx={{ mt: 6, mx: "auto", maxWidth: 600 }}>
                    <Grid container spacing={3}>
                        {[
                            { icon: "⚡", title: "Instant Setup", desc: "Under 60 seconds from connection to working APIs" },
                            { icon: "🔒", title: "Privacy First", desc: "Credentials never leave your browser" },
                            { icon: "🌍", title: "Multi-Language", desc: "Code generation in 9+ programming languages" },
                            { icon: "📊", title: "Auto Documentation", desc: "Swagger docs generated automatically" },
                        ].map((f, idx) => (
                            <Grid key={idx} item xs={12} sm={6}>
                                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                    <Box sx={{ fontSize: 16 }}>{f.icon}</Box>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, color: "#F8FAFC", fontSize: 13 }}>{f.title}</Typography>
                                        <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>{f.desc}</Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Bottom Helper Banner */}
                <Box sx={{ mt: 6, mx: "auto", maxWidth: 700, p: 2.5, borderRadius: 2, background: "linear-gradient(90deg, #1E293B, rgba(30,41,59,0))", display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ fontSize: 20, color: "#8B5CF6" }}>🔒</Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                            Your database credentials are encrypted and stored locally. We never send them to our servers.
                        </Typography>
                    </Box>
                    <Button sx={{ color: "#8B5CF6", textDecoration: "underline" }} onClick={() => navigate("/documentation")}>
                        Learn more →
                    </Button>
                </Box>
            </Box>
        </Box>

    )

}