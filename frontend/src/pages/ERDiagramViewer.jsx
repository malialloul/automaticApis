import React, { memo, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  InputBase,
  Dialog,
  Stack,
  Grid,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import DownloadIcon from "@mui/icons-material/Download";
import RelationshipGraph from "../components/RelationshipGraph";
import { me } from "../services/auth";

const ERDiagramViewer = ({ connection }) => {
 
  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: "#181c24",
        color: "#fff",
        position: "relative",
      }}
    >
      {/* Show message if no connectionId */}
      {!connection?.id ? (
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" color="warning.main">
            Please select a connection to view the relationship graph.
          </Typography>
        </Box>
      ) : (
        <Grid item xs={12}>
          <RelationshipGraph
            connectionId={connection?.id}
            databaseName={connection?.database}
          />
        </Grid>
      )}
    </Box>
  );
};

export default memo(ERDiagramViewer);
