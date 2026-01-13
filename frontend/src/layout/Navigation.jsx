import {
  AppBar,
  Toolbar,
  Container,
  Button,
  IconButton,
  Box,
  Typography,
} from "@mui/material";
import { Brightness4, Brightness7, Storage } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";

export default function Navigation({ darkMode, setDarkMode }) {
  return (
    <AppBar
      position="fixed"
      color="default"
      sx={{
        backdropFilter: "blur(10px)",
        boxShadow: 1,
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Storage sx={{ color: "white", fontSize: 24 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Prism
            </Typography>
          </Box>

          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 4 }}>
            <Button color="inherit" href="#features">
              Features
            </Button>
            <Button color="inherit" href="#how-it-works">
              How It Works
            </Button>
            <Button color="inherit" href="#pricing">
              Pricing
            </Button>
            <Button color="inherit" href="#docs">
              Docs
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
            <Button
              variant="contained"
              component={RouterLink}
              to="/dashboard"
              sx={{
                background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
                },
              }}
            >
              Get Started
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
