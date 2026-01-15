import { Box, Button, Collapse, Typography, Chip } from '@mui/material';
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
    if (!schema || !selectedTable) return null;

    const activeFiltersCount = Object.values(filters || {}).filter(f => f?.val !== '' && f?.val !== undefined).length;

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Button 
                    size="small" 
                    variant={filtersCollapsed ? 'outlined' : 'contained'}
                    onClick={() => setFiltersCollapsed((s) => !s)}
                >
                    {filtersCollapsed ? 'Filters & Options' : 'Hide Filters'}
                </Button>
                {activeFiltersCount > 0 && (
                    <Chip label={`${activeFiltersCount} active`} size="small" color="primary" />
                )}
            </Box>

            <Collapse in={!filtersCollapsed}>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Filter results by column values
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {schema && selectedTable && (schema[selectedTable]?.columns || [])
                            .filter(c => !(c.name || '').toLowerCase().includes('password'))
                            .map((c) => (
                                <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ minWidth: 100, fontWeight: 500 }}>
                                        {c.name}
                                    </Typography>
                                    <Box sx={{ flex: 1 }}>
                                        {renderFilterField(c)}
                                    </Box>
                                </Box>
                            ))}
                    </Box>

                    {operation === 'GET' && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
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
        </Box>
    );
};

export default AdditionalFiltersToggle;
