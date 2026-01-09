import React, { useEffect, useState } from 'react';
import { Container, Box, Typography, Grid, Paper } from '@mui/material';
import { loadConnections } from '../../utils/storage';

const StatCard = ({ title, value, caption }) => (
  <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
    <Typography variant="h5" sx={{ fontWeight: 700 }}>{value}</Typography>
    <Typography variant="subtitle1" sx={{ mb: 0.5 }}>{title}</Typography>
    <Typography variant="caption" color="text.secondary">{caption}</Typography>
  </Paper>
);

const Stats = () => {
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [healthTime, setHealthTime] = useState('—');

  useEffect(() => {
    try {
      const conns = loadConnections();
      setConnectionsCount(conns.length);
    } catch {}
    (async () => {
      try {
        const res = await fetch((import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/health');
        const data = await res.json();
        setHealthTime(new Date(data.timestamp).toLocaleString());
      } catch {}
    })();
  }, []);

  return (
    <Box sx={{ py: { xs: 5, md: 7 }, bgcolor: 'grey.100' }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ mb: { xs: 2, md: 3 }, fontWeight: 700, textAlign: { xs: 'center', md: 'left' } }}>By The Numbers</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}><StatCard title="Saved Connections" value={connectionsCount} caption="From local storage" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard title="Backend Templates" value={5} caption="Express, FastAPI, Gin, Spring, ASP.NET" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard title="Exports" value={2} caption="PNG & SVG for ER diagrams" /></Grid>
          <Grid item xs={12} sm={6} md={3}><StatCard title="Server Health" value={healthTime} caption="Latest heartbeat" /></Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Stats;
