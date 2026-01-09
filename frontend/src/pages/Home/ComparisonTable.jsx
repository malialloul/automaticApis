import { Container, Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Avatar } from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { motion } from 'motion/react';

const MotionPaper = motion.create(Paper);

const comparisons = [
  {
    feature: 'Privacy (credentials in browser)',
    prism: true,
    hasura: false,
    supabase: false,
    postgrest: false,
    dreamfactory: false,
  },
  {
    feature: 'Multi-language code generation',
    prism: true,
    hasura: false,
    supabase: false,
    postgrest: false,
    dreamfactory: false,
  },
  {
    feature: 'MySQL + PostgreSQL support',
    prism: true,
    hasura: true,
    supabase: false,
    postgrest: false,
    dreamfactory: true,
  },
  {
    feature: 'Instant API generation',
    prism: true,
    hasura: true,
    supabase: true,
    postgrest: true,
    dreamfactory: true,
  },
  {
    feature: 'ER diagram visualization',
    prism: true,
    hasura: true,
    supabase: false,
    postgrest: false,
    dreamfactory: false,
  },
  {
    feature: 'Auto Swagger documentation',
    prism: true,
    hasura: false,
    supabase: true,
    postgrest: false,
    dreamfactory: true,
  },
  {
    feature: 'Zero infrastructure setup',
    prism: true,
    hasura: false,
    supabase: false,
    postgrest: false,
    dreamfactory: false,
  },
  {
    feature: 'Free tier',
    prism: true,
    hasura: true,
    supabase: true,
    postgrest: true,
    dreamfactory: true,
  },
];

export default function ComparisonTable() {
  return (
    <Box sx={{ py: 12, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={8}>
          <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 700, mb: 2 }}>
            How we compare
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
            See why developers choose Prism for API generation
          </Typography>
        </Box>

        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          elevation={4}
          sx={{ overflow: 'hidden' }}
        >
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Feature</TableCell>
                  <TableCell align="center" sx={{ minWidth: 100 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                          fontWeight: 700,
                        }}
                      >
                        P
                      </Avatar>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                        Prism
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' }}>
                    Hasura
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' }}>
                    Supabase
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' }}>
                    PostgREST
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.secondary' }}>
                    DreamFactory
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparisons.map((row, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:last-child td': { border: 0 },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{row.feature}</TableCell>
                    <TableCell align="center">
                      {row.prism ? (
                        <CheckCircle sx={{ color: 'primary.main', fontSize: 24 }} />
                      ) : (
                        <Cancel sx={{ color: 'action.disabled', fontSize: 24 }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.hasura ? (
                        <CheckCircle sx={{ color: 'text.secondary', fontSize: 24 }} />
                      ) : (
                        <Cancel sx={{ color: 'action.disabled', fontSize: 24 }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.supabase ? (
                        <CheckCircle sx={{ color: 'text.secondary', fontSize: 24 }} />
                      ) : (
                        <Cancel sx={{ color: 'action.disabled', fontSize: 24 }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.postgrest ? (
                        <CheckCircle sx={{ color: 'text.secondary', fontSize: 24 }} />
                      ) : (
                        <Cancel sx={{ color: 'action.disabled', fontSize: 24 }} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.dreamfactory ? (
                        <CheckCircle sx={{ color: 'text.secondary', fontSize: 24 }} />
                      ) : (
                        <Cancel sx={{ color: 'action.disabled', fontSize: 24 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MotionPaper>
      </Container>
    </Box>
  );
}
