import { memo } from "react";
import {
  Box,
  Typography,
  Paper,
  alpha,
} from "@mui/material";
import { useConnection } from "../../_shared/database/useConnection";
import { RelationshipGraph } from "./RelationshipGraph/RelationshipGraph";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import StorageIcon from "@mui/icons-material/Storage";

const ERDiagramViewer = () => {
  const {
    currentConnection,
  } = useConnection();
  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: "background.default",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Show message if no connectionId */}
      {!currentConnection?.id ? (
        <Box sx={{ p: 3, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Paper
            variant="outlined"
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: 3,
              borderStyle: "dashed",
              maxWidth: 400,
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <StorageIcon sx={{ fontSize: 32, color: "warning.main" }} />
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
              No Connection Selected
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please select a database connection to view the ER diagram and table relationships.
            </Typography>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <RelationshipGraph />
        </Box>
      )}
    </Box>
  );
};

export default memo(ERDiagramViewer);
