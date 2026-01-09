import { Container, Box, Typography, Grid, Card, CardContent, Button, List, ListItem, ListItemIcon, ListItemText, Chip, Paper } from '@mui/material';
import { CheckCircle, Star } from '@mui/icons-material';
import { motion } from 'motion/react';

const MotionCard = motion.create(Card);

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for side projects and testing',
    features: [
      'Up to 3 database connections',
      'All database types (MySQL, PostgreSQL)',
      'CRUD API generation',
      'Code in 9+ languages',
      'ER diagram visualization',
      'Swagger documentation',
      'Community support',
    ],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For professional developers and teams',
    features: [
      'Unlimited database connections',
      'All Free features',
      'Advanced relationship mapping',
      'Custom endpoint generation',
      'Export full project code',
      'GraphQL support (coming soon)',
      'Priority support',
      'Early access to new features',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
];

const allFeatures = [
  'Multi-database support (MySQL, PostgreSQL)',
  'Instant CRUD API generation',
  'Multi-language code generation',
  'Interactive ER diagrams',
  'Auto-generated Swagger docs',
  'Privacy-first architecture',
  'No infrastructure setup',
  'Relationship endpoint support',
];

export default function Pricing() {
  return (
    <Box
      id="pricing"
      sx={{
        py: 12,
        background: theme => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #1a1f35 0%, #2d1b4e 30%)'
          : 'linear-gradient(135deg, #f9fafb 0%, #ede9fe 100%)',
      }}
    >
      <Container maxWidth="lg">
        <Box textAlign="center" mb={8}>
          <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 700, mb: 2 }}>
            Simple, transparent pricing
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
            Start free, upgrade when you need more
          </Typography>
        </Box>

        {/* Pricing Cards */}
        <Grid container spacing={4} sx={{ mb: 8, maxWidth: '1000px', mx: 'auto' }}>
          {plans.map((plan, index) => (
            <Grid item xs={12} md={6} key={index}>
              <MotionCard
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                sx={{
                  height: '100%',
                  position: 'relative',
                  bgcolor: 'background.paper',
                  border: plan.highlighted ? 2 : 1,
                  borderColor: plan.highlighted ? 'primary.main' : 'divider',
                  boxShadow: plan.highlighted ? 8 : 2,
                }}
              >
                {plan.highlighted && (
                  <Chip
                    icon={<Star />}
                    label="Most Popular"
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontWeight: 600,
                    }}
                  />
                )}

                <CardContent sx={{ p: 4 }}>
                  <Box mb={3}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {plan.description}
                    </Typography>
                  </Box>

                  <Box mb={3}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant="h3" sx={{ fontWeight: 700 }}>
                        {plan.price}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        / {plan.period}
                      </Typography>
                    </Box>
                  </Box>

                  <Button
                    variant={plan.highlighted ? 'contained' : 'outlined'}
                    fullWidth
                    size="large"
                    sx={{
                      mb: 3,
                      py: 1.5,
                      ...(plan.highlighted && {
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                        },
                      }),
                    }}
                  >
                    {plan.cta}
                  </Button>

                  <List sx={{ py: 0 }}>
                    {plan.features.map((feature, idx) => (
                      <ListItem key={idx} sx={{ px: 0, py: 1 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircle sx={{ color: 'primary.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={feature}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </MotionCard>
            </Grid>
          ))}
        </Grid>

        {/* All Features */}
        <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
          <Paper elevation={4} sx={{ p: 4, bgcolor: 'background.paper' }}>
            <Typography variant="h5" textAlign="center" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
              All plans include
            </Typography>
            <Grid container spacing={2}>
              {allFeatures.map((feature, idx) => (
                <Grid item xs={12} sm={6} key={idx}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.5,
                      }}
                    >
                      <CheckCircle sx={{ color: 'white', fontSize: 14 }} />
                    </Box>
                    <Typography variant="body2">{feature}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
