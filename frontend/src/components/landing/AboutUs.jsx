import React from 'react';
import { Container, Box, Typography, Grid, Paper } from '@mui/material';

const AboutUs = () => {
  return (
    <Box sx={{ py: { xs: 5, md: 7 } }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ mb: { xs: 2, md: 3 }, fontWeight: 700, textAlign: { xs: 'center', md: 'left' } }}>About Us</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: { xs: 'center', md: 'left' } }}>
          We help teams ship robust APIs fast. From instant CRUD + relations to beautiful ER diagrams and docs, we streamline backend delivery.
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Mission</Typography>
              <Typography variant="body2" color="text.secondary">Enable developers to build, document, and visualize APIs with minimal friction.</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Values</Typography>
              <Typography variant="body2" color="text.secondary">Simplicity, reliability, and creative tooling that feels delightful.</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Team</Typography>
              <Typography variant="body2" color="text.secondary">Product-minded engineers building for developers and data teams.</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AboutUs;
