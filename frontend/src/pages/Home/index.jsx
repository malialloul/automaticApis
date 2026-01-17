import { useState } from "react";
import {  CssBaseline } from "@mui/material";
import FeaturesGrid from "./FeaturesGrid";
import HowItWorks from "./HowItWorks";
import ComparisonTable from "./ComparisonTable";
import Pricing from "./Pricing";
import Footer from "./Footer";
import Hero from "./Hero";

export default function Home() {

  return (
    <>
      <Hero />
      <FeaturesGrid />
      <HowItWorks />
      <ComparisonTable />
      <Pricing />
      <Footer />
    </>
  );
}
