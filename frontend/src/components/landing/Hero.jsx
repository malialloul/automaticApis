import React from 'react';
import { Container, Box, Typography, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{
      bgcolor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0ea5e9 100%)',
      background: 'radial-gradient(1000px 400px at 10% 10%, rgba(14,165,233,0.25), transparent), linear-gradient(135deg, #0f172a 0%, #1e293b 60%)',
      color: 'white',
      py: { xs: 6, md: 10 },
    }}>
      <Container maxWidth="lg">
        <Stack spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
          <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: -0.5, textAlign: { xs: 'center', md: 'left' } }}>
            Everything you need to ship fast
          </Typography>
          <Typography variant="h6" sx={{ maxWidth: 720, opacity: 0.9, textAlign: { xs: 'center', md: 'left' } }}>
            Connect Postgres, introspect schema, and generate CRUD + relation endpoints, docs, code snippets, and ERDs — in minutes.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-start' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button variant="contained" color="primary" onClick={() => navigate('/signup')}>Get Started</Button>
            <Button variant="outlined" color="inherit" onClick={() => navigate('/pricing')}>View Pricing</Button>
          </Stack>
          <Box sx={{ mt: 4, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
            <img alt="preview-1" src="https://placehold.co/720x440/0ea5e9/ffffff?text=API+Docs+Preview" style={{ width: '100%', maxWidth: 360, height: 220, borderRadius: 12, objectFit: 'cover' }} />
            <img alt="preview-2" src="https://placehold.co/720x440/1e293b/ffffff?text=ER+Diagram+Preview" style={{ width: '100%', maxWidth: 360, height: 220, borderRadius: 12, objectFit: 'cover' }} />
            <img alt="preview-3" src="https://placehold.co/720x440/0f172a/ffffff?text=API+Generator+Preview" style={{ width: '100%', maxWidth: 360, height: 220, borderRadius: 12, objectFit: 'cover' }} />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default Hero;