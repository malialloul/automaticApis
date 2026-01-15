import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, Select, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Button } from '@mui/material';

export default function DataDialog({ setDataTable, open, onClose, dataTable, dataRows, dataLoading, dataError, limit, setLimit, offset, handlePrevPage, handleNextPage, dataColumns, handleChangeOrder, openEditDialog, openDeleteDialog, deleteLoading, deleteTargetKey, fetchTableData }) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>{dataTable ? `Data: ${dataTable}` : 'Data'}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Button size="small" variant="contained" onClick={() => openEditDialog(null)} sx={{ mr: 2 }}>Add</Button>
                    <Typography variant="body2">Limit</Typography>
                    <Select size="small" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); fetchTableData(dataTable, { limit: Number(e.target.value), offset: 0 }); }}>
                        {[10, 25, 50, 100].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                    <Typography variant="body2" sx={{ ml: 2 }}>Offset</Typography>
                    <Typography variant="body2">{offset}</Typography>
                    <Button size="small" onClick={handlePrevPage} disabled={offset === 0 || dataLoading}>Prev</Button>
                    <Button size="small" onClick={handleNextPage} disabled={dataLoading || dataRows.length < limit}>Next</Button>
                    {dataError && <Typography variant="body2" color="error">{dataError}</Typography>}
                </Box>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {dataColumns.map((col) => (
                                <TableCell key={col} onClick={() => handleChangeOrder(col)} sx={{ cursor: 'pointer' }}>{col}</TableCell>
                            ))}
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {dataLoading ? (
                            <TableRow>
                                <TableCell colSpan={dataColumns.length + 1}><Typography variant="body2">Loading…</Typography></TableCell>
                            </TableRow>
                        ) : dataRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={dataColumns.length + 1}><Typography variant="body2" color="text.secondary">No data</Typography></TableCell>
                            </TableRow>
                        ) : (
                            dataRows.map((row, idx) => (
                                <TableRow key={idx}>
                                    {dataColumns.map((col) => (
                                        <TableCell key={col}>{row[col] === null || row[col] === undefined ? '—' : String(row[col])}</TableCell>
                                    ))}
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button size="small" variant="outlined" onClick={() => openEditDialog(row)}>Edit</Button>
                                            <Button size="small" color="error" variant="outlined" onClick={() => openDeleteDialog(row)} disabled={deleteLoading && deleteTargetKey === (row && row[Object.keys(row || {})[0]])}>
                                                {deleteLoading && deleteTargetKey === (row && row[Object.keys(row || {})[0]]) ? <CircularProgress size={16} /> : 'Delete'}
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
