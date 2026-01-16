import { 
    Dialog, 
    DialogContent, 
    DialogActions, 
    Typography, 
    Box, 
    Button, 
    CircularProgress,
    IconButton,
    Alert,
    Paper,
    alpha,
    useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function DeleteDialog({ open, onClose, deleteTargetRow, deleteTargetKey, deleteError, deleteLoading, handleDeleteConfirm }) {
    const theme = useTheme();
    
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
                            bgcolor: alpha(theme.palette.error.main, 0.1),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <WarningAmberIcon sx={{ color: "error.main", fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            Confirm Delete
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            This action cannot be undone
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 2.5 }}>
                <Alert 
                    severity="warning" 
                    sx={{ 
                        mb: 2.5, 
                        borderRadius: 2,
                        "& .MuiAlert-icon": { alignItems: "center" },
                    }}
                >
                    Are you sure you want to delete this row? This will permanently remove the data from your database.
                </Alert>
                
                {deleteTargetRow && (
                    <Paper 
                        variant="outlined" 
                        sx={{ 
                            p: 2, 
                            borderRadius: 2,
                            bgcolor: "action.hover",
                        }}
                    >
                        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            Row Data (Key: {typeof deleteTargetKey === 'object' ? JSON.stringify(deleteTargetKey) : String(deleteTargetKey)})
                        </Typography>
                        <Box 
                            component="pre" 
                            sx={{ 
                                m: 0,
                                p: 1.5,
                                bgcolor: "background.paper",
                                borderRadius: 1.5,
                                fontSize: 12,
                                fontFamily: "monospace",
                                overflow: "auto",
                                maxHeight: 200,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}
                        >
                            {JSON.stringify(deleteTargetRow, null, 2)}
                        </Box>
                    </Paper>
                )}
                
                {deleteError && (
                    <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                        {deleteError}
                    </Alert>
                )}
            </DialogContent>
            
            <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: "divider", gap: 1 }}>
                <Button 
                    onClick={onClose} 
                    disabled={deleteLoading}
                    sx={{ borderRadius: 2, textTransform: "none" }}
                >
                    Cancel
                </Button>
                <Button 
                    color="error" 
                    variant="contained" 
                    onClick={handleDeleteConfirm} 
                    disabled={deleteLoading}
                    startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                    sx={{ 
                        borderRadius: 2, 
                        textTransform: "none",
                        minWidth: 100,
                    }}
                >
                    {deleteLoading ? "Deleting..." : "Delete Row"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
