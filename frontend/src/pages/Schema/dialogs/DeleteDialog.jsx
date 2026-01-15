import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, Button, CircularProgress } from '@mui/material';

export default function DeleteDialog({ open, onClose, deleteTargetRow, deleteTargetKey, deleteError, deleteLoading, handleDeleteConfirm }) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogContent dividers>
                <Typography>Are you sure you want to delete this row?</Typography>
                {deleteTargetRow ? (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="caption">Key: {typeof deleteTargetKey === 'object' ? JSON.stringify(deleteTargetKey) : String(deleteTargetKey)}</Typography>
                        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(deleteTargetRow, null, 2)}</pre>
                    </Box>
                ) : null}
                {deleteError && <Typography color="error">{deleteError}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={deleteLoading}>Cancel</Button>
                <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleteLoading}>
                    {deleteLoading ? <CircularProgress size={16} /> : 'Delete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
