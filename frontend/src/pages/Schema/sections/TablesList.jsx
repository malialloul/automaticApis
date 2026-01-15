import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, Chip, Button, Tooltip, IconButton, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import KeyIcon from "@mui/icons-material/Key";

export default function TablesList({ setDataTable, filteredTables, openAddDialog, openDataViewer, handleExportTable }) {
    if (!filteredTables) return null;
    return (
        <>
            {filteredTables.map(([tableName, tableInfo]) => (
                <Accordion key={tableName} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                width: "100%",
                            }}
                        >
                            <Typography variant="h6">{tableName}</Typography>
                            <Chip
                                label={`${tableInfo.columns.length} columns`}
                                size="small"
                            />
                            {tableInfo.foreignKeys?.length > 0 && (
                                <Chip
                                    label={`${tableInfo.foreignKeys.length} FK`}
                                    size="small"
                                    color="primary"
                                    icon={<LinkIcon />}
                                />
                            )}
                            {tableInfo.reverseForeignKeys?.length > 0 && (
                                <Chip
                                    label={`${tableInfo.reverseForeignKeys.length} reverse FK`}
                                    size="small"
                                    color="secondary"
                                    icon={<LinkIcon />}
                                />
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Add row">
                                <span>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDataTable(tableName); // set the current table

                                            openAddDialog(tableName);
                                        }}
                                    >
                                        Add
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip title="View data">
                                <span>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openDataViewer(tableName);
                                        }}
                                    >
                                        View Data
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip title="Export table schema">
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExportTable(tableName);
                                        }}
                                    >
                                        <span role="img" aria-label="export">
                                            📤
                                        </span>
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </AccordionSummary>

                    <AccordionDetails>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Column</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell>Nullable</TableCell>
                                        <TableCell>Default</TableCell>
                                        <TableCell>Keys</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableInfo.columns.map((column) => {
                                        const isPK = tableInfo.primaryKeys?.includes(column.name);
                                        const fk = tableInfo.foreignKeys?.find(
                                            (fk) => fk.columnName === column.name
                                        );

                                        return (
                                            <TableRow key={column.name}>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={isPK ? "bold" : "normal"}
                                                    >
                                                        {column.name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={column.type}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>{column.nullable ? "Yes" : "No"}</TableCell>
                                                <TableCell>
                                                    <Typography variant="caption">
                                                        {column.default || "-"}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {isPK && (
                                                        <Chip
                                                            label="PK"
                                                            size="small"
                                                            color="success"
                                                            icon={<KeyIcon />}
                                                        />
                                                    )}
                                                    {fk && (
                                                        <Chip
                                                            label={`FK → ${fk.foreignTable}`}
                                                            size="small"
                                                            color="primary"
                                                            sx={{ ml: 0.5 }}
                                                        />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {tableInfo.reverseForeignKeys?.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Referenced By:
                                </Typography>
                                {tableInfo.reverseForeignKeys.map((rfk, idx) => (
                                    <Chip
                                        key={idx}
                                        label={`${rfk.referencingTable} (${rfk.referencingColumn})`}
                                        size="small"
                                        sx={{ m: 0.5 }}
                                        color="secondary"
                                    />
                                ))}
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </>
    );
}
