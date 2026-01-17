import { Container, Box, Typography, Grid, IconButton, Link, Paper } from '@mui/material';
import { Storage, GitHub, Twitter, Email, Favorite } from '@mui/icons-material';

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {/* Brand */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Storage sx={{ color: 'white', fontSize: 24 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Prism
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Privacy-first database API generation for developers who value speed and control.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                href="https://github.com"
                target="_blank"
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected', color: 'primary.main' },
                }}
              >
                <GitHub fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                href="https://twitter.com"
                target="_blank"
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected', color: 'primary.main' },
                }}
              >
                <Twitter fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                href="mailto:hello@prism.dev"
                sx={{
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected', color: 'primary.main' },
                }}
              >
                <Email fontSize="small" />
              </IconButton>
            </Box>
          </Grid>

          {/* Product */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Product
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="#features" color="text.secondary" underline="hover" variant="body2">
                Features
              </Link>
              <Link href="#pricing" color="text.secondary" underline="hover" variant="body2">
                Pricing
              </Link>
              <Link href="#docs" color="text.secondary" underline="hover" variant="body2">
                Documentation
              </Link>
              <Link href="#changelog" color="text.secondary" underline="hover" variant="body2">
                Changelog
              </Link>
              <Link href="#roadmap" color="text.secondary" underline="hover" variant="body2">
                Roadmap
              </Link>
            </Box>
          </Grid>

          {/* Resources */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Resources
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="#examples" color="text.secondary" underline="hover" variant="body2">
                Examples
              </Link>
              <Link href="#guides" color="text.secondary" underline="hover" variant="body2">
                Guides
              </Link>
              <Link href="#blog" color="text.secondary" underline="hover" variant="body2">
                Blog
              </Link>
              <Link href="#community" color="text.secondary" underline="hover" variant="body2">
                Community
              </Link>
              <Link href="#support" color="text.secondary" underline="hover" variant="body2">
                Support
              </Link>
            </Box>
          </Grid>

          {/* Company */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
              Company
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="#about" color="text.secondary" underline="hover" variant="body2">
                About
              </Link>
              <Link href="#privacy" color="text.secondary" underline="hover" variant="body2">
                Privacy Policy
              </Link>
              <Link href="#terms" color="text.secondary" underline="hover" variant="body2">
                Terms of Service
              </Link>
              <Link href="#security" color="text.secondary" underline="hover" variant="body2">
                Security
              </Link>
              <Link href="#contact" color="text.secondary" underline="hover" variant="body2">
                Contact
              </Link>
            </Box>
          </Grid>
        </Grid>

        {/* Privacy Promise */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
            border: 1,
            borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <Favorite sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
              Privacy Promise
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: '600px', mx: 'auto' }}>
            Your database credentials never leave your browser. All connections are made directly from your device.
            We don't store, transmit, or have access to your sensitive data.
          </Typography>
        </Paper>

        {/* Bottom Bar */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            pt: 4,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © 2026 Prism. All rights reserved.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Made with
            </Typography>
            <Favorite sx={{ fontSize: 16, color: '#ef4444' }} />
            <Typography variant="body2" color="text.secondary">
              for developers
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
