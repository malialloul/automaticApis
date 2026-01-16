import { useMemo } from "react";
import { useConnection } from "../../_shared/database/useConnection";
import { AppBar, Box, Button, IconButton, Tab, Tabs, Toolbar, Tooltip, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import StorageIcon from "@mui/icons-material/Storage";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

export const ConsoleLayoutBar = ({ darkMode, setDarkMode }) => {
    const {
        currentConnection,
    } = useConnection();
    const navigate = useNavigate()
    const tabs = useMemo(
        () => [
            { label: "Dashboard", path: "/dashboard", disabled: false },
            { label: "Schema", path: "/schema", disabled: !currentConnection },
            {
                label: "ER Diagram",
                path: "/er-diagram",
                disabled: !currentConnection,
            },
            { label: "APIs", path: "/db-apis", disabled: !currentConnection },
        ],
        [currentConnection]
    );

    const currentIndex = tabs.findIndex((t) =>
        location.pathname.startsWith(t.path)
    );
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
                value={currentIndex === -1 ? 0 : currentIndex}
                onChange={(_, idx) =>
                    !tabs[idx].disabled && navigate(tabs[idx].path)
                }
                sx={{ minHeight: 48, height: 48 }}
            >
                {tabs.map((t) => {
                    const tabEl = (
                        <Tab
                            key={t.path}
                            label={t.label}
                            disabled={t.disabled}
                            sx={{ minHeight: 48, height: 48 }}
                        />
                    );
                    return t.disabled ? (
                        <Tooltip
                            key={t.path}
                            title="Connect a database first to access this feature"
                        >
                            <span>{tabEl}</span>
                        </Tooltip>
                    ) : (
                        tabEl
                    );
                })}
            </Tabs>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
                {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
        </Toolbar>
    </AppBar>
}