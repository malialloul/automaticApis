import React from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Box, 
    Typography, 
    Select, 
    MenuItem, 
    Table, 
    TableHead, 
    TableRow, 
    TableCell, 
    TableBody, 
    CircularProgress, 
    Button,
    IconButton,
    Chip,
    Paper,
    alpha,
    useTheme,
    TableContainer,
    Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SortIcon from '@mui/icons-material/Sort';
import TableChartIcon from '@mui/icons-material/TableChart';

export default function DataDialog({ setDataTable, open, onClose, dataTable, dataRows, dataLoading, dataError, limit, setLimit, offset, handlePrevPage, handleNextPage, dataColumns, handleChangeOrder, openEditDialog, openDeleteDialog, deleteLoading, deleteTargetKey, fetchTableData }) {
    const theme = useTheme();
    
    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            fullWidth 
            maxWidth="lg"
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    maxHeight: "90vh",
                }
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
                            background: "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <TableChartIcon sx={{ color: "white", fontSize: 22 }} />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            {dataTable || "Data Viewer"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {dataRows.length} row{dataRows.length !== 1 ? "s" : ""} loaded
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: "text.secondary" }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ p: 0 }}>
                {/* Toolbar */}
                <Box 
                    sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: "space-between",
                        gap: 2, 
                        p: 2,
                        borderBottom: 1,
                        borderColor: "divider",
                        bgcolor: "action.hover",
                    }}
                >
                    <Button 
                        size="small" 
                        variant="contained" 
                        startIcon={<AddIcon />}
                        onClick={() => openEditDialog(null)} 
                        sx={{ 
                            borderRadius: 2,
                            textTransform: "none",
                        }}
                    >
                        Add Row
                    </Button>
                    
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary">Rows per page:</Typography>
                            <Select 
                                size="small" 
                                value={limit} 
                                onChange={(e) => { 
                                    setLimit(Number(e.target.value)); 
                                    fetchTableData(dataTable, { limit: Number(e.target.value), offset: 0 }); 
                                }}
                                sx={{ 
                                    minWidth: 70,
                                    "& .MuiSelect-select": { py: 0.75 },
                                }}
                            >
                                {[10, 25, 50, 100].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                            </Select>
                        </Box>
                        
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <IconButton 
                                size="small" 
                                onClick={handlePrevPage} 
                                disabled={offset === 0 || dataLoading}
                                sx={{ bgcolor: "background.paper" }}
                            >
                                <NavigateBeforeIcon />
                            </IconButton>
                            <Chip 
                                label={`${offset + 1} - ${offset + dataRows.length}`} 
                                size="small" 
                                sx={{ minWidth: 80, justifyContent: "center" }}
                            />
                            <IconButton 
                                size="small" 
                                onClick={handleNextPage} 
                                disabled={dataLoading || dataRows.length < limit}
                                sx={{ bgcolor: "background.paper" }}
                            >
                                <NavigateNextIcon />
                            </IconButton>
                        </Box>

                        {dataError && (
                            <Chip 
                                label={dataError} 
                                size="small" 
                                color="error" 
                                variant="outlined" 
                            />
                        )}
                    </Box>
                </Box>

                {/* Table */}
                <TableContainer sx={{ maxHeight: "calc(90vh - 250px)" }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                {dataColumns.map((col) => (
                                    <TableCell 
                                        key={col} 
                                        onClick={() => handleChangeOrder(col)} 
                                        sx={{ 
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: 12,
                                            bgcolor: "background.paper",
                                            "&:hover": { color: "primary.main" },
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            {col}
                                            <SortIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                                        </Box>
                                    </TableCell>
                                ))}
                                <TableCell sx={{ fontWeight: 600, fontSize: 12, bgcolor: "background.paper" }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {dataLoading ? (
                                <TableRow>
                                    <TableCell colSpan={dataColumns.length + 1} sx={{ textAlign: "center", py: 6 }}>
                                        <CircularProgress size={32} />
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Loading data...
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : dataRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={dataColumns.length + 1} sx={{ textAlign: "center", py: 6 }}>
                                        <Typography variant="body2" color="text.secondary">No data found</Typography>
                                        <Typography variant="caption" color="text.disabled">This table is empty</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dataRows.map((row, idx) => (
                                    <TableRow 
                                        key={idx} 
                                        hover
                                        sx={{ "&:last-child td": { borderBottom: 0 } }}
                                    >
                                        {dataColumns.map((col) => (
                                            <TableCell 
                                                key={col}
                                                sx={{ 
                                                    maxWidth: 200,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    fontSize: 13,
                                                }}
                                            >
                                                {row[col] === null || row[col] === undefined 
                                                    ? <Typography variant="caption" color="text.disabled">null</Typography>
                                                    : String(row[col])}
                                            </TableCell>
                                        ))}
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="Edit">
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => openEditDialog(row)}
                                                        sx={{ 
                                                            color: "primary.main",
                                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={() => openDeleteDialog(row)} 
                                                        disabled={deleteLoading && deleteTargetKey === (row && row[Object.keys(row || {})[0]])}
                                                        sx={{ 
                                                            color: "error.main",
                                                            bgcolor: alpha(theme.palette.error.main, 0.1),
                                                            "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.2) },
                                                        }}
                                                    >
                                                        {deleteLoading && deleteTargetKey === (row && row[Object.keys(row || {})[0]]) 
                                                            ? <CircularProgress size={16} /> 
                                                            : <DeleteIcon fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
        </Dialog>
    );
}
