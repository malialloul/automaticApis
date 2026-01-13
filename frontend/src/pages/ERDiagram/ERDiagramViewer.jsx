import { memo } from "react";
import {
  Box,
  Typography,

  Grid,
} from "@mui/material";
import { useConnection } from "../../_shared/database/useConnection";
import { RelationshipGraph } from "./RelationshipGraph/RelationshipGraph";

const ERDiagramViewer = () => {
  const {
    currentConnection,
  } = useConnection();
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
      {!currentConnection?.id ? (
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" color="warning.main">
            Please select a connection to view the relationship graph.
          </Typography>
        </Box>
      ) : (
        <Grid item xs={12}>
          <RelationshipGraph />
        </Grid>
      )}
    </Box>
  );
};

export default memo(ERDiagramViewer);
