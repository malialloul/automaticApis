import { Box, Typography, Divider } from "@mui/material";
import ReactJson from "@microlink/react-json-view";

const ResponseViewer = ({ response }) => {
  if (!response) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6">Response</Typography>
      <Typography variant="body2">
        Status: {response.status} {response.statusText}
      </Typography>

      <Box sx={{ mt: 2, bgcolor: "grey.900", p: 2 }}>
        <ReactJson src={response.data} theme="monokai" collapsed={1} />
      </Box>
    </Box>
  );
};

export default ResponseViewer;
