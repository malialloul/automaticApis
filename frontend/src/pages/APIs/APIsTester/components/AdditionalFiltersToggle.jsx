import { Grid, Button, Collapse } from '@mui/material';
import GetOptionsPanel from './GetOptionsPanel';
import { renderColumnControl } from '../../../../_shared/database/utils';

const AdditionalFiltersToggle = ({
    schema,
    selectedTable,
    pathParams,
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

    return (
        <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
                <Button size="small" onClick={() => setFiltersCollapsed((s) => !s)}>
                    {filtersCollapsed ? 'Show additional filters' : 'Hide additional filters'}
                </Button>
            </Grid>

            <Grid item xs={12}>
                <Collapse in={!filtersCollapsed}>
                    <Grid container spacing={1}>
                        {schema && selectedTable && (schema[selectedTable]?.columns || [])
                            .filter((c) => !(c.name in (pathParams || {})))
                            .map((c) => (
                                <Grid item xs={12} md={6} key={c.name}>
                                    {renderFilterField(c)}
                                </Grid>
                            ))}

                        {operation === 'GET' && (
                            <Grid container item spacing={1} sx={{ mt: 1 }}>
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
                            </Grid>
                        )}
                    </Grid>
                </Collapse>
            </Grid>
        </Grid>
    );
};

export default AdditionalFiltersToggle;
