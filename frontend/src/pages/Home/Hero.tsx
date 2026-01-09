import { Container, Box, Typography, Button, Chip, Paper } from '@mui/material';
import { ArrowForward, PlayArrow, Circle, ArrowRight } from '@mui/icons-material';
import { motion } from 'motion/react';

const MotionBox = motion.create(Box);
const MotionPaper = motion.create(Paper);

export default function Hero() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        pt: 10,
        pb: 8,
        position: 'relative',
        overflow: 'hidden',
        background: theme => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(59,130,246,0.1) 100%)'
          : 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(59,130,246,0.05) 100%)',
      }}
    >
      {/* Grid Background */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: theme => theme.palette.mode === 'dark'
            ? 'linear-gradient(rgba(139,92,246,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.1) 1px, transparent 1px)'
            : 'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black, transparent)',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          textAlign="center"
        >
          {/* Badge */}
          <Chip
            icon={<Circle sx={{ fontSize: 8, animation: 'pulse 2s infinite', color: '#8b5cf6 !important' }} />}
            label="Privacy-first API generation"
            sx={{
              mb: 4,
              bgcolor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              color: 'primary.main',
            }}
          />

          {/* Main Headline */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '4.5rem' },
              fontWeight: 700,
              mb: 3,
              background: theme => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #ffffff 0%, #c4b5fd 50%, #93c5fd 100%)'
                : 'linear-gradient(135deg, #1f2937 0%, #7c3aed 50%, #2563eb 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2,
            }}
          >
            Your Database. Your APIs.
            <br />
            Your Privacy.
          </Typography>

          {/* Subheadline */}
          <Typography
            variant="h5"
            sx={{
              mb: 6,
              maxWidth: '800px',
              mx: 'auto',
              color: 'text.secondary',
              lineHeight: 1.6,
            }}
          >
            Auto-generate REST APIs from any database. Multi-language code generation. Zero setup.{' '}
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
              Your credentials never leave your browser.
            </Box>
          </Typography>

          {/* CTA Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 8 }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              sx={{
                px: 4,
                py: 1.5,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
                  boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)',
                },
              }}
            >
              Get Started Free
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<PlayArrow />}
              sx={{
                px: 4,
                py: 1.5,
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(139, 92, 246, 0.05)',
                },
              }}
            >
              View Demo
            </Button>
          </Box>

          {/* Hero Visual */}
          <MotionPaper
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            elevation={24}
            sx={{
              maxWidth: '1000px',
              mx: 'auto',
              overflow: 'hidden',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: -4,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                opacity: 0.2,
                filter: 'blur(40px)',
                zIndex: -1,
              },
            }}
          >
          </MotionPaper>
        </MotionBox>
      </Container>
    </Box>
  );
}
