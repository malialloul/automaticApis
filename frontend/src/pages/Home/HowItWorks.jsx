import { Container, Box, Typography, Grid, Card, CardContent, Avatar } from '@mui/material';
import { Storage, Search, AutoAwesome, Code } from '@mui/icons-material';
import { motion } from 'motion/react';

const MotionCard = motion.create(Card);

const steps = [
  {
    icon: Storage,
    title: 'Connect your database',
    description: 'Enter your MySQL or PostgreSQL credentials. Everything happens locally in your browser.',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    number: '01',
  },
  {
    icon: Search,
    title: 'We introspect your schema',
    description: 'Prism analyzes your tables, columns, relationships, and constraints automatically.',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    number: '02',
  },
  {
    icon: AutoAwesome,
    title: 'APIs generated instantly',
    description: 'Full CRUD endpoints with filtering, sorting, pagination, and relationship support.',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    number: '03',
  },
  {
    icon: Code,
    title: 'Copy code & start building',
    description: 'Get production-ready code in your preferred language. Swagger docs included.',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    number: '04',
  },
];

export default function HowItWorks() {
  return (
    <Box
      id="how-it-works"
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
            From database to API in seconds
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
            No complex setup. No backend code to write. Just instant APIs.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {steps.map((step, index) => (
            <Grid item xs={12} sm={6} lg={3} key={index}>
              <MotionCard
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                sx={{
                  height: '100%',
                  position: 'relative',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    boxShadow: 8,
                  },
                }}
              >
                <Avatar
                  sx={{
                    position: 'absolute',
                    top: -16,
                    right: 16,
                    width: 48,
                    height: 48,
                    bgcolor: 'text.primary',
                    color: 'background.paper',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                  }}
                >
                  {step.number}
                </Avatar>

                <CardContent sx={{ p: 4 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      background: step.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                    }}
                  >
                    <step.icon sx={{ color: 'white', fontSize: 32 }} />
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {step.description}
                  </Typography>
                </CardContent>
              </MotionCard>
            </Grid>
          ))}
        </Grid>

        <Box textAlign="center" mt={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Box
              component="button"
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                color: 'white',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                boxShadow: 3,
                transition: 'all 0.3s',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              Try it now - it's free
            </Box>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
}
