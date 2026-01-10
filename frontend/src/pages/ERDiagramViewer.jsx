import React, { memo, useState } from "react";
import { Box, Typography, IconButton, Select, MenuItem, Tooltip, Paper, InputBase, Dialog, Stack, Grid } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import FitScreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import DownloadIcon from "@mui/icons-material/Download";
import RelationshipGraph from "../components/RelationshipGraph";
import { me } from "../services/auth";

const layoutOptions = ["Hierarchical", "Force-directed", "Circular"];

const ERDiagramViewer = (({ connection}) => {
  const [layout, setLayout] = useState(layoutOptions[0]);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");

  // Controls
  const handleLayoutChange = (e) => setLayout(e.target.value);
  const handleFullscreen = () => setFullscreen((f) => !f);
  return (
    <Box sx={{ height: "100vh", bgcolor: "#181c24", color: "#fff", position: "relative" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 2, gap: 2, bgcolor: "#23272f" }}>
        <Typography variant="h5" sx={{ fontWeight: "bold" }}>
          Entity Relationship Diagram
        </Typography>
        <Typography variant="body1" sx={{ ml: 2 }}>
          {connection?.database}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Select value={layout} onChange={handleLayoutChange} size="small" sx={{ mx: 2, bgcolor: "#23272f", color: "#fff" }}>
          {layoutOptions.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
        </Select>
        <Tooltip title="Fullscreen"><IconButton onClick={handleFullscreen} color="inherit"><FullscreenIcon /></IconButton></Tooltip>
      </Box>

      {/* Show message if no connectionId */}
      {!connection?.id ? (
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" color="warning.main">
            Please select a connection to view the relationship graph.
          </Typography>
        </Box>
      ) : (
        <Grid item xs={12}>
          <RelationshipGraph connectionId={connection?.id} />
        </Grid>
      )}
    </Box>
  );
});

export default memo(ERDiagramViewer);
