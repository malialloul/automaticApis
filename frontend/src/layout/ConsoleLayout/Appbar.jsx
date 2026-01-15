import { useMemo } from "react";
import { useConnection } from "../../_shared/database/useConnection";
import { AppBar, Box, Button, IconButton, Tab, Tabs, TextField, Toolbar, Tooltip } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
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
            { label: "Docs", path: "/documentation", disabled: !currentConnection },
        ],
        [currentConnection]
    );

    const currentIndex = tabs.findIndex((t) =>
        location.pathname.startsWith(t.path)
    );
    return <AppBar position="fixed" color="default" sx={{ boxShadow: 1 }}>
        <Toolbar sx={{ gap: 2 }}>
            <Tooltip title="Back to home">
                <IconButton color="inherit" onClick={() => navigate('/')} aria-label="home">
                    <HomeIcon />
                </IconButton>
            </Tooltip>
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
            <TextField
                size="small"
                placeholder="Search (Ctrl/Cmd + K)"
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1 }} /> }}
            />
            <Button variant="outlined">Upgrade</Button>
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
                {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
        </Toolbar>
    </AppBar>
}