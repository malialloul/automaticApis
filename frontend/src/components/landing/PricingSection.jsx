import React, { useEffect, useState } from 'react';
import { Container, Grid, Paper, Typography, Box, Button, List, ListItem, ListItemText } from '@mui/material';
import { getPlans } from '../../services/auth';
import { useNavigate } from 'react-router-dom';

const PricingSection = () => {
  const [plans, setPlans] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { (async () => { try { setPlans(await getPlans()); } catch {} })(); }, []);

  return (
    <Box sx={{ py: 6 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>Simple, transparent pricing</Typography>
        <Grid container spacing={3}>
          {plans.map((p) => (
            <Grid item xs={12} md={4} key={p.id}>
              <Paper elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                <Typography variant="h3" sx={{ my: 1 }}>{p.priceMonthly ? `$${p.priceMonthly}` : 'Free'}<Typography variant="subtitle2" component="span">/mo</Typography></Typography>
                <Box sx={{ flexGrow: 1 }}>
                  <List dense>
                    {p.features.map((f, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5 }}>
                        <ListItemText primary={f} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
                <Button variant="contained" onClick={() => navigate('/signup')}>Choose {p.name}</Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default PricingSection;