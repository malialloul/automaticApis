import { Box, Button, Grid, Typography, Card, CardContent, Container, Chip, Paper, useTheme, alpha } from "@mui/material";
import { LISTENERS } from "../../_shared/listeners";
import AddIcon from "@mui/icons-material/Add";
import StorageIcon from "@mui/icons-material/Storage";
import BoltIcon from "@mui/icons-material/Bolt";
import SchemaIcon from "@mui/icons-material/Schema";
import CodeIcon from "@mui/icons-material/Code";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { motion } from "motion/react";

const MotionBox = motion.create(Box);
const MotionCard = motion.create(Card);
const MotionPaper = motion.create(Paper);

const features = [
    {
        icon: StorageIcon,
        title: "Multi-Database Support",
        description: "Connect to MySQL & PostgreSQL databases seamlessly",
        gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    },
    {
        icon: BoltIcon,
        title: "Instant API Generation",
        description: "Auto-generate REST endpoints for all your tables",
        gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    },
    {
        icon: SchemaIcon,
        title: "ER Diagrams",
        description: "Visualize relationships with interactive diagrams",
        gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    },
    {
        icon: CodeIcon,
        title: "Multi-Language Code",
        description: "Get code in JavaScript, Python, Go, and more",
        gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    },
];

const steps = [
    { number: 1, title: "Add Connection", desc: "Click the button below to connect your database" },
    { number: 2, title: "Auto Introspection", desc: "We analyze your schema and relationships" },
    { number: 3, title: "APIs Generated", desc: "Get instant REST endpoints for all tables" },
    { number: 4, title: "Start Building", desc: "Explore, test, and generate code snippets" },
];

export const NoConnections = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box
            sx={{
                minHeight: "calc(100vh - 64px)",
                background: isDark
                    ? "linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(59,130,246,0.05) 100%)"
                    : "linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(59,130,246,0.03) 100%)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Grid Background */}
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: isDark
                        ? "linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)"
                        : "linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)",
                    backgroundSize: "4rem 4rem",
                    maskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black, transparent)",
                }}
            />

            <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, py: 6 }}>
                {/* Hero Section */}
                <MotionBox
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    sx={{ textAlign: "center", mb: 6 }}
                >
                    {/* Icon */}
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: 3,
                            background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mx: "auto",
                            mb: 3,
                            boxShadow: "0 8px 32px rgba(139, 92, 246, 0.3)",
                        }}
                    >
                        <StorageIcon sx={{ fontSize: 40, color: "white" }} />
                    </Box>

                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 700,
                            mb: 2,
                            background: isDark
                                ? "linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #93c5fd 100%)"
                                : "linear-gradient(135deg, #1f2937 0%, #7c3aed 50%, #2563eb 100%)",
                            backgroundClip: "text",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Connect Your First Database
                    </Typography>

                    <Typography
                        variant="h6"
                        sx={{
                            color: "text.secondary",
                            maxWidth: 600,
                            mx: "auto",
                            mb: 4,
                            lineHeight: 1.6,
                        }}
                    >
                        Start generating REST APIs instantly. Your credentials stay in your browser -{" "}
                        <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                            privacy first, always.
                        </Box>
                    </Typography>

                    {/* CTA Button */}
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={() => window.dispatchEvent(new CustomEvent(LISTENERS.OPEN_ADD_CONNECTION))}
                        sx={{
                            px: 4,
                            py: 1.5,
                            fontSize: "1rem",
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.4)",
                            "&:hover": {
                                background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                                boxShadow: "0 8px 30px rgba(139, 92, 246, 0.5)",
                                transform: "translateY(-2px)",
                            },
                            transition: "all 0.3s ease",
                        }}
                    >
                        Connect Database
                    </Button>
                </MotionBox>

                {/* How It Works */}
                <MotionBox
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    sx={{ mb: 6 }}
                >
                    <Typography
                        variant="overline"
                        sx={{
                            display: "block",
                            textAlign: "center",
                            color: "primary.main",
                            fontWeight: 600,
                            letterSpacing: 2,
                            mb: 3,
                        }}
                    >
                        How It Works
                    </Typography>

                    <Grid container spacing={2} justifyContent="center">
                        {steps.map((step, idx) => (
                            <Grid item xs={6} sm={3} key={idx}>
                                <MotionCard
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                                    sx={{
                                        height: "100%",
                                        bgcolor: "background.paper",
                                        border: 1,
                                        borderColor: "divider",
                                        textAlign: "center",
                                        position: "relative",
                                        overflow: "visible",
                                        "&:hover": {
                                            borderColor: "primary.main",
                                            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                                        },
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "50%",
                                                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                                                color: "white",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 700,
                                                fontSize: "1rem",
                                                mx: "auto",
                                                mb: 1.5,
                                            }}
                                        >
                                            {step.number}
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                            {step.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                            {step.desc}
                                        </Typography>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        ))}
                    </Grid>
                </MotionBox>

                {/* Features Grid */}
                <MotionBox
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    sx={{ mb: 6 }}
                >
                    <Typography
                        variant="overline"
                        sx={{
                            display: "block",
                            textAlign: "center",
                            color: "primary.main",
                            fontWeight: 600,
                            letterSpacing: 2,
                            mb: 3,
                        }}
                    >
                        What You'll Get
                    </Typography>

                    <Grid container spacing={3}>
                        {features.map((feature, idx) => (
                            <Grid item xs={12} sm={6} md={3} key={idx}>
                                <MotionCard
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
                                    sx={{
                                        height: "100%",
                                        bgcolor: "background.paper",
                                        border: 1,
                                        borderColor: "divider",
                                        "&:hover": {
                                            borderColor: "primary.main",
                                            boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                                            transform: "translateY(-4px)",
                                        },
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    <CardContent sx={{ p: 3 }}>
                                        <Box
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 2,
                                                background: feature.gradient,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                mb: 2,
                                            }}
                                        >
                                            <feature.icon sx={{ color: "white", fontSize: 24 }} />
                                        </Box>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            {feature.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                            {feature.description}
                                        </Typography>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        ))}
                    </Grid>
                </MotionBox>

                {/* Privacy Banner */}
                <MotionPaper
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6 }}
                    sx={{
                        p: 3,
                        background: isDark
                            ? `linear-gradient(135deg, ${alpha("#8b5cf6", 0.1)} 0%, ${alpha("#3b82f6", 0.1)} 100%)`
                            : `linear-gradient(135deg, ${alpha("#8b5cf6", 0.05)} 0%, ${alpha("#3b82f6", 0.05)} 100%)`,
                        border: 1,
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                        borderRadius: 3,
                    }}
                >
                    <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} md={8}>
                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                                <Box
                                    sx={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <SecurityIcon sx={{ color: "primary.main", fontSize: 24 }} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={600} gutterBottom>
                                        Your Privacy, Our Priority
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                        All database credentials are encrypted and stored locally in your browser.
                                        We never send your sensitive information to our servers. Your data stays yours.
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                {["Browser-only storage", "No server calls", "100% Open Source"].map((item, idx) => (
                                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <CheckCircleIcon sx={{ color: "success.main", fontSize: 18 }} />
                                        <Typography variant="body2" fontWeight={500}>
                                            {item}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Grid>
                    </Grid>
                </MotionPaper>

                {/* Supported Databases */}
                <MotionBox
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    sx={{ mt: 6, textAlign: "center" }}
                >
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Supported Databases
                    </Typography>
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
                        {[
                            { name: "PostgreSQL", color: "#336791" },
                            { name: "MySQL", color: "#00758F" },
                        ].map((db) => (
                            <Chip
                                key={db.name}
                                label={db.name}
                                sx={{
                                    bgcolor: alpha(db.color, 0.1),
                                    color: db.color,
                                    fontWeight: 600,
                                    border: `1px solid ${alpha(db.color, 0.3)}`,
                                }}
                            />
                        ))}
                    </Box>
                </MotionBox>
            </Container>
        </Box>
    );
};