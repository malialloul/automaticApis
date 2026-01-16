import React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogActions, 
    Box, 
    Button,
    IconButton,
    Alert,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';

export default function EditDialog({ open, onClose, tableColumns, renderInputField, editMode, editError, editLoading, handleEditSubmit }) {
    if (!tableColumns) return null;
    
    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="sm"
            PaperProps={{
                sx: { borderRadius: 3 }
            }}
        >
            {/* Custom Header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: 2.5,
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            background: editMode === 'add' 
                                ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                                : "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {editMode === 'add' 
                            ? <AddIcon sx={{ color: "white", fontSize: 22 }} />
                            : <EditIcon sx={{ color: "white", fontSize: 22 }} />}
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {editMode === 'add' ? 'Add New Row' : 'Edit Row'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {tableColumns.length} field{tableColumns.length !== 1 ? "s" : ""} available
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {tableColumns.map((col) => {
                        const input = renderInputField(col);
                        if (input === null) return null;
                        return (
                            <Box key={col.name}>
                                {input}
                            </Box>
                        );
                    })}
                </Box>
                
                {editError && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {editError}
                    </Alert>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: "divider", gap: 1 }}>
                <Button 
                    onClick={onClose}
                    sx={{ borderRadius: 2, textTransform: "none" }}
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleEditSubmit} 
                    variant="contained" 
                    disabled={editLoading}
                    startIcon={editMode === 'add' ? <AddIcon /> : <SaveIcon />}
                    sx={{ 
                        borderRadius: 2, 
                        textTransform: "none",
                        minWidth: 100,
                    }}
                >
                    {editLoading ? "Saving..." : (editMode === 'add' ? 'Add Row' : 'Save Changes')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
