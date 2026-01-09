import React from 'react';
import { Container, Box, Typography, Link as MuiLink, Stack } from '@mui/material';
import { Link } from 'react-router-dom';

const Footer = () => (
  <Box sx={{ bgcolor: '#0f172a', color: 'white', py: 4, mt: 6 }}>
    <Container maxWidth="lg">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Typography variant="subtitle1" sx={{ opacity: 0.85 }}>© {new Date().getFullYear()} Automatic APIs</Typography>
        <Stack direction="row" spacing={2}>
          <MuiLink component={Link} to="/pricing" color="inherit" underline="hover">Pricing</MuiLink>
          <MuiLink component={Link} to="/documentation" color="inherit" underline="hover">Docs</MuiLink>
          <MuiLink component={Link} to="/apis" color="inherit" underline="hover">APIs</MuiLink>
        </Stack>
      </Stack>
    </Container>
  </Box>
);

export default Footer;