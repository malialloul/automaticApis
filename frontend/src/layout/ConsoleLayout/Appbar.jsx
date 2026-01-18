import { useMemo } from "react";
import { useConnection } from "../../_shared/database/useConnection";
import { AppBar, Box, Button, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import StorageIcon from "@mui/icons-material/Storage";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import TourHelpButton from "../../_shared/tour/TourHelpButton";

export const ConsoleLayoutBar = ({ darkMode, setDarkMode }) => {
    const {
        currentConnection,
    } = useConnection();
    const navigate = useNavigate()
    const tabs = useMemo(
        () => [
            { label: "Dashboard", path: "/dashboard", disabled: false },
            { label: "Schema Builder", path: "/schema-builder", disabled: false },
            { label: "Schema", path: "/schema", disabled: !currentConnection || (currentConnection?.type === 'local') },
            {
                label: "ER Diagram",
                path: "/er-diagram",
                disabled: !currentConnection,
            },
            { label: "APIs", path: "/db-apis", disabled: !currentConnection },
        ],
        [currentConnection]
    );

    // Find current tab - sort by path length (longest first) to match /schema-builder before /schema
    const currentIndex = (() => {
        const sorted = [...tabs].sort((a, b) => b.path.length - a.path.length);
        const matched = sorted.find(t => location.pathname.startsWith(t.path));
        return matched ? tabs.indexOf(matched) : 0;
    })();
    return <AppBar position="fixed" color="default" sx={{ boxShadow: 1, backdropFilter: "blur(10px)" }}>
        <Toolbar sx={{ gap: 2 }}>
            {/* Logo/Brand */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={() => navigate('/')}>
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <StorageIcon sx={{ color: "white", fontSize: 20 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'block' } }}>
                    Prism
                </Typography>
            </Box>

            <Tabs
                value={currentIndex}
                onChange={(_, idx) =>
                    !tabs[idx].disabled && navigate(tabs[idx].path)
                }
                sx={{ minHeight: 48, height: 48 }}
                data-tour="nav-tabs"
            >
                {tabs.map((t) => {
                    const isSchemaLocalDisabled = t.path === '/schema' && currentConnection && currentConnection.type === 'local';
                    const tabEl = (
                        <Tab
                            key={t.path}
                            label={t.label}
                            disabled={t.disabled}
                            sx={{ minHeight: 48, height: 48 }}
                        />
                    );
                    if (!t.disabled) return tabEl;

                    // Build tooltip content based on disabled reason
                    const tooltipContent = isSchemaLocalDisabled ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="caption">Local database: manage your schema in Schema Builder.</Typography>
                            <Button size="small" variant="contained" onClick={() => navigate('/schema-builder')} sx={{ textTransform: 'none' }}>
                                Open Schema Builder
                            </Button>
                        </Box>
                    ) : (
                        'Connect a database first to access this feature'
                    );

                    return (
                        <Tooltip key={t.path} title={tooltipContent} disableInteractive={false}>
                            <span>{tabEl}</span>
                        </Tooltip>
                    );
                })}
            </Tabs>
            <Box sx={{ flex: 1 }} />
            <TourHelpButton />
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit" data-tour="theme-toggle">
                {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
        </Toolbar>
    </AppBar>
}