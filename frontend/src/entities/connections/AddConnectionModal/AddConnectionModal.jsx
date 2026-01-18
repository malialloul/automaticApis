import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useConnection } from "../../../_shared/database/useConnection";
import ConnectionForm from "./ConnectionForm";

export const AddConnectionModal = ({ openDialog, setOpenDialog }) => {
  const {
    selectConnection,
    saveCurrentConnection,
  } = useConnection();

  return (
    <Dialog
      open={openDialog}
      onClose={() => setOpenDialog(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Add Connection</DialogTitle>
      <DialogContent dividers>
        <ConnectionForm
          onConnectionSaved={(conn) => {
            saveCurrentConnection(conn);
            window.dispatchEvent(new CustomEvent("connections-changed"));
            selectConnection(conn);
            setOpenDialog(false);
            window.dispatchEvent(
              new CustomEvent("toast", {
                detail: {
                  message: "Database connected successfully",
                  severity: "success",
                },
              }),
            );
          }}
          onSchemaLoaded={() => {
            // backend introspection done; nothing else required
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
