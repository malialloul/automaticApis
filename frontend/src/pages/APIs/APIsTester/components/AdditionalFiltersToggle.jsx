import { Box, Button, Collapse, Typography, Chip, Paper, alpha, useTheme } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import GetOptionsPanel from './GetOptionsPanel';
import { renderColumnControl } from '../../../../_shared/database/utils';

const AdditionalFiltersToggle = ({
    schema,
    selectedTable,
    filtersCollapsed,
    setFiltersCollapsed,
    filters,
    handleFilterValueChange,
    orderBy,
    setOrderBy,
    orderDir,
    setOrderDir,
    pageSize,
    setPageSize,
    pageNumber,
    setPageNumber,
    foreignKeyOptions,
    operation,
    renderFilterField
}) => {
    const theme = useTheme();

    if (!schema || !selectedTable) return null;

    const activeFiltersCount = Object.values(filters || {}).filter(f => f?.val !== '' && f?.val !== undefined).length;

    return (
        <Paper variant="outlined" sx={{ mb: 3, borderRadius: 3, overflow: "hidden" }}>
            <Box 
                sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    p: 2,
                    cursor: 'pointer',
                    "&:hover": { bgcolor: "action.hover" },
                }}
                onClick={() => setFiltersCollapsed((s) => !s)}
            >
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <FilterListIcon sx={{ color: "primary.main", fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                        Filters & Options
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {activeFiltersCount > 0 
                            ? `${activeFiltersCount} filter${activeFiltersCount !== 1 ? 's' : ''} active` 
                            : 'Click to add filters'}
                    </Typography>
                </Box>
                {activeFiltersCount > 0 && (
                    <Chip 
                        label={activeFiltersCount} 
                        size="small" 
                        color="primary"
                        sx={{ height: 22, fontWeight: 600 }}
                    />
                )}
                {filtersCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
            </Box>

            <Collapse in={!filtersCollapsed}>
                <Box sx={{ p: 2.5, borderTop: 1, borderColor: "divider" }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                        Filter by Column
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {schema && selectedTable && (schema[selectedTable]?.columns || [])
                            .filter(c => !(c.name || '').toLowerCase().includes('password'))
                            .map((c) => (
                                <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography 
                                        variant="body2" 
                                        sx={{ 
                                            minWidth: 120, 
                                            fontWeight: 500,
                                            color: "text.secondary",
                                        }}
                                    >
                                        {c.name}
                                    </Typography>
                                    <Box sx={{ flex: 1 }}>
                                        {renderFilterField(c)}
                                    </Box>
                                </Box>
                            ))}
                    </Box>

                    {operation === 'GET' && (
                        <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                                Sorting & Pagination
                            </Typography>
                            <GetOptionsPanel
                                columns={(schema[selectedTable]?.columns || [])}
                                orderBy={orderBy}
                                setOrderBy={setOrderBy}
                                orderDir={orderDir}
                                setOrderDir={setOrderDir}
                                pageSize={pageSize}
                                setPageSize={setPageSize}
                                pageNumber={pageNumber}
                                setPageNumber={setPageNumber}
                            />
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
};

export default AdditionalFiltersToggle;
