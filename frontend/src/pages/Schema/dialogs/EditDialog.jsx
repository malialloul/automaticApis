import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Button } from '@mui/material';

export default function EditDialog({ open, onClose, tableColumns, renderInputField, editMode, editError, editLoading, handleEditSubmit }) {
    if (!tableColumns) return null;
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{editMode === 'add' ? 'Add Row' : 'Edit Row'}</DialogTitle>
            <DialogContent dividers>
                {tableColumns.map((col) => {
                    const input = renderInputField(col);
                    if (input === null) return null;
                    return (
                        <Box key={col.name} sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{col.name}</Typography>
                            {input}
                        </Box>
                    );
                })}
                {editError && <Typography color="error">{editError}</Typography>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleEditSubmit} variant="contained" disabled={editLoading}>{editMode === 'add' ? 'Add' : 'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
}
