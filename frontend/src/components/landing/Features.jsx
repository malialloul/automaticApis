import React from 'react';
import { Container, Grid, Paper, Typography, Box } from '@mui/material';

const FEATURES = [
  { title: 'Instant CRUD', desc: 'Auto-generate endpoints for every table with pagination, sorting, and filtering.' },
  { title: 'Relations', desc: 'Belongs-to and has-many endpoints from your foreign keys.' },
  { title: 'Docs & Snippets', desc: 'Swagger + ready-to-copy client and backend code in multiple languages.' },
  { title: 'ER Diagrams', desc: 'Visualize schema, export PNG/SVG, and share with your team.' },
  { title: 'Secure by Default', desc: 'Parameterized queries and identifier sanitization to guard against injection.' },
  { title: 'Zero Boilerplate', desc: 'Skip scaffolding — connect, introspect, and ship fast.' },
];

const Features = () => (
  <Box sx={{ py: { xs: 5, md: 7 } }}>
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mb: { xs: 2, md: 3 }, fontWeight: 700, textAlign: { xs: 'center', md: 'left' } }}>Everything you need to ship fast</Typography>
      <Grid container spacing={3}>
        {FEATURES.map((f) => (
          <Grid item xs={12} sm={6} md={4} key={f.title}>
            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, height: '100%', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{f.title}</Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>{f.desc}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  </Box>
);

export default Features;