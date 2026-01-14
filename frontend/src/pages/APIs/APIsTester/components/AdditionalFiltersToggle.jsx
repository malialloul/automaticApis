import { Grid, Button, Collapse } from '@mui/material';
import GetOptionsPanel from '../GetOptionsPanel';
import { renderColumnControl } from '../../../_shared/database/utils';

const AdditionalFiltersToggle = ({
    schema,
    selectedTable,
    endpoint,
    pathParams,
    filtersCollapsed,
    setFiltersCollapsed,
    getOperatorsForColumn,
    filters,
    handleFilterOpChange,
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
                        {(() => {
                            const crossTableMatch =
                                endpoint?.path &&
                                endpoint.path.match(/\/([a-zA-Z0-9_]+)\/by_([a-zA-Z0-9_]+)\/:([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/);
                            if (crossTableMatch && schema) {
                                const refTable = crossTableMatch[1];
                                const fkCol = crossTableMatch[2];
                                const targetTable = crossTableMatch[4];
                                let fkColObj = schema[refTable]?.columns?.find((c) => c.name === fkCol);
                                let joinTable = Object.keys(schema).find((t) => {
                                    const fks = schema[t]?.foreignKeys || [];
                                    return (
                                        fks.some((fk) => fk.columnName === fkCol && fk.foreignTable === refTable) &&
                                        fks.some((fk) => fk.foreignTable === targetTable)
                                    );
                                });
                                const refCols = schema[refTable]?.columns || [];
                                let joinCols = [];
                                if (joinTable) joinCols = (schema[joinTable]?.columns || []).filter((c) => c.name !== fkCol);
                                else joinCols = (schema[targetTable]?.columns || []).filter((c) => c.name !== fkCol);
                                const seen = new Set();
                                const allCols = [...refCols, ...joinCols].filter((c) => {
                                    if (seen.has(c.name)) return false;
                                    seen.add(c.name);
                                    return true;
                                });
                                if (fkColObj && !allCols.some((c) => c.name === fkCol)) allCols.unshift(fkColObj);
                                if (allCols.length === 0) {
                                    const fallbackCols = [...(schema[refTable]?.columns || []), ...(schema[targetTable]?.columns || [])].filter((c) => c.name !== fkCol);
                                    return fallbackCols
                                        .filter((c) => !(c.name in (pathParams || {})))
                                        .map((c) => (
                                            <Grid item xs={12} md={6} key={c.name}>
                                                {renderColumnControl({ col: c, value: filters[c.name]?.val ?? '', onChange: (v) => handleFilterValueChange(c.name, v), schema, tableName: refTable, foreignKeyOptions })}
                                            </Grid>
                                        ));
                                }
                                return allCols
                                    .filter((c) => !(c.name in (pathParams || {})))
                                    .map((c) => (
                                        <Grid item xs={12} md={6} key={c.name}>
                                            {renderColumnControl({ col: c, value: filters[c.name]?.val ?? '', onChange: (v) => handleFilterValueChange(c.name, v), schema, tableName: refTable, foreignKeyOptions })}
                                        </Grid>
                                    ));
                            }

                            const fkMatch = endpoint?.path?.match(/by_([a-zA-Z0-9_]+)\/:(\w+)/);
                            let excludeCol = fkMatch ? fkMatch[1] : null;
                            return (
                                schema &&
                                selectedTable &&
                                (schema[selectedTable]?.columns || [])
                                    .filter((c) => c.name !== excludeCol && !(c.name in (pathParams || {})))
                                    .map((c) => (
                                        <Grid item xs={12} md={6} key={c.name}>
                                            {renderColumnControl({ col: c, value: filters[c.name]?.val ?? '', onChange: (v) => handleFilterValueChange(c.name, v), schema, tableName: selectedTable, foreignKeyOptions })}
                                        </Grid>
                                    ))
                            );
                        })()}

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
