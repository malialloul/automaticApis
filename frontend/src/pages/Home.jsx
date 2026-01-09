import React from 'react';
import { Container, Grid, Box, Paper, Typography } from '@mui/material';
import ConnectionForm from '../components/ConnectionForm';
import ConnectionList from '../components/ConnectionList';
import Dashboard from '../components/Dashboard';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import PricingSection from '../components/landing/PricingSection';
import Footer from '../components/landing/Footer';
import AboutUs from '../components/landing/AboutUs';
import Stats from '../components/landing/Stats';

const Home = ({ connection, onConnectionSaved, onConnectionSelect, onConnectionDelete, onSchemaLoaded }) => {
  return (
    <Box>
      <Hero />
      <Features />
      <Stats />
      <AboutUs />
      <PricingSection />
      <Footer />
    </Box>
  );
};

export default Home;
