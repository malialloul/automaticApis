import { createTheme } from "@mui/material";

const createAppTheme = (darkMode = false) =>
    createTheme({
        palette: {
            mode: darkMode ? "dark" : "light",
            primary: {
                main: "#8b5cf6",
            },
            secondary: {
                main: "#3b82f6",
            },
            background: {
                default: darkMode ? "#0a0e1a" : "#ffffff",
                paper: darkMode ? "#1a1f35" : "#f9fafb",
            },
        },
        typography: {
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        shape: {
            borderRadius: 12,
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    // Optional: global scrollbar styles
                    body: {
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${darkMode ? '#475569' : '#94A3B8'} ${darkMode ? '#1E293B' : '#FFFFFF'}`,
                    },
                    '*::-webkit-scrollbar': { height: 10, width: 10 },
                    '*::-webkit-scrollbar-track': { background: darkMode ? '#1E293B' : '#FFFFFF', borderRadius: 8 },
                    '*::-webkit-scrollbar-thumb': { backgroundColor: darkMode ? '#475569' : '#94A3B8', borderRadius: 8, border: `2px solid ${darkMode ? '#1E293B' : '#FFFFFF'}` },
                    '*::-webkit-scrollbar-thumb:hover': { backgroundColor: '#64748B' },
                    '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 },
                    },
                },
            },
            MuiTableContainer: {
                styleOverrides: {
                    root: {
                        backgroundColor: darkMode ? '#1E293B' : '#F8FAFC',
                        border: '1px solid #334155',
                        borderRadius: 0,
                        overflowX: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${darkMode ? '#475569' : '#94A3B8'} ${darkMode ? '#1E293B' : '#FFFFFF'}`,
                    },
                },
            },
        },
    });

export { createAppTheme };