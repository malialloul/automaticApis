import { 
    Accordion, 
    AccordionSummary, 
    AccordionDetails, 
    Box, 
    Typography, 
    Chip, 
    Button, 
    Tooltip, 
    IconButton, 
    TableContainer, 
    Table, 
    TableHead, 
    TableRow, 
    TableCell, 
    TableBody,
    alpha,
    useTheme,
    Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import KeyIcon from "@mui/icons-material/Key";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";

export default function TablesList({ setDataTable, filteredTables, openAddDialog, openDataViewer, handleExportTable }) {
    const theme = useTheme();
    
    if (!filteredTables || filteredTables.length === 0) {
        return (
            <Paper 
                variant="outlined" 
                sx={{ 
                    p: 6, 
                    textAlign: "center", 
                    borderRadius: 3,
                    borderStyle: "dashed",
                }}
            >
                <TableChartIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                <Typography color="text.secondary">No tables found</Typography>
                <Typography variant="caption" color="text.disabled">
                    Connect a database and refresh to see tables
                </Typography>
            </Paper>
        );
    }
    
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }} data-tour="schema-tables">
            {filteredTables.map(([tableName, tableInfo], index) => (
                <Accordion 
                    key={tableName} 
                    sx={{ 
                        borderRadius: "12px !important",
                        border: 1,
                        borderColor: "divider",
                        boxShadow: "none",
                        "&:before": { display: "none" },
                        "&.Mui-expanded": {
                            margin: 0,
                            borderColor: "primary.main",
                        },
                        overflow: "hidden",
                    }}
                >
                    <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                            px: 2.5,
                            "&:hover": { bgcolor: "action.hover" },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 2,
                                width: "100%",
                                pr: 2,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <TableChartIcon sx={{ color: "primary.main", fontSize: 20 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                    {tableName}
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                    <Chip
                                        icon={<ViewColumnIcon sx={{ fontSize: "14px !important" }} />}
                                        label={`${tableInfo.columns.length} cols`}
                                        size="small"
                                        sx={{ 
                                            height: 22, 
                                            fontSize: 11,
                                            bgcolor: alpha(theme.palette.info.main, 0.1),
                                            color: "info.main",
                                            "& .MuiChip-icon": { color: "info.main" },
                                        }}
                                    />
                                    {tableInfo.foreignKeys?.length > 0 && (
                                        <Chip
                                            icon={<LinkIcon sx={{ fontSize: "14px !important" }} />}
                                            label={`${tableInfo.foreignKeys.length} FK`}
                                            size="small"
                                            sx={{ 
                                                height: 22, 
                                                fontSize: 11,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: "primary.main",
                                                "& .MuiChip-icon": { color: "primary.main" },
                                            }}
                                        />
                                    )}
                                    {tableInfo.reverseForeignKeys?.length > 0 && (
                                        <Chip
                                            label={`${tableInfo.reverseForeignKeys.length} refs`}
                                            size="small"
                                            sx={{ 
                                                height: 22, 
                                                fontSize: 11,
                                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                                color: "secondary.main",
                                            }}
                                        />
                                    )}
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }} data-tour={index === 0 ? "schema-table-actions" : undefined}>
                                <Tooltip title="Add row">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDataTable(tableName);
                                            openAddDialog(tableName);
                                        }}
                                        sx={{ 
                                            bgcolor: alpha(theme.palette.success.main, 0.1),
                                            color: "success.main",
                                            "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.2) },
                                        }}
                                    >
                                        <AddIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="View data">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openDataViewer(tableName);
                                        }}
                                        sx={{ 
                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                            color: "primary.main",
                                            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                                        }}
                                    >
                                        <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Export schema">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExportTable(tableName);
                                        }}
                                        sx={{ 
                                            bgcolor: "action.hover",
                                            "&:hover": { bgcolor: "action.selected" },
                                        }}
                                    >
                                        <FileDownloadIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                        <TableContainer 
                            sx={{ 
                                border: 1, 
                                borderColor: "divider", 
                                borderRadius: 2,
                                overflow: "hidden",
                            }}
                        >
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: "action.hover" }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Column</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Nullable</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Default</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Keys</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tableInfo.columns.map((column, idx) => {
                                        const isPK = tableInfo.primaryKeys?.includes(column.name);
                                        const fk = tableInfo.foreignKeys?.find(
                                            (fk) => fk.columnName === column.name
                                        );

                                        return (
                                            <TableRow 
                                                key={column.name}
                                                sx={{ 
                                                    "&:last-child td": { borderBottom: 0 },
                                                    bgcolor: isPK ? alpha(theme.palette.success.main, 0.04) : "transparent",
                                                }}
                                            >
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={isPK ? 600 : 400}
                                                        sx={{ color: isPK ? "success.main" : "text.primary" }}
                                                    >
                                                        {column.name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={column.type}
                                                        size="small"
                                                        sx={{ 
                                                            height: 22,
                                                            fontSize: 11,
                                                            fontFamily: "monospace",
                                                            bgcolor: alpha(theme.palette.info.main, 0.08),
                                                            color: "info.main",
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={column.nullable ? "Yes" : "No"}
                                                        size="small"
                                                        sx={{ 
                                                            height: 20,
                                                            fontSize: 10,
                                                            bgcolor: column.nullable 
                                                                ? alpha(theme.palette.warning.main, 0.1)
                                                                : alpha(theme.palette.success.main, 0.1),
                                                            color: column.nullable ? "warning.main" : "success.main",
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography 
                                                        variant="caption" 
                                                        sx={{ 
                                                            fontFamily: "monospace",
                                                            color: "text.secondary",
                                                        }}
                                                    >
                                                        {column.default || "—"}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: "flex", gap: 0.5 }}>
                                                        {isPK && (
                                                            <Chip
                                                                icon={<KeyIcon sx={{ fontSize: "12px !important" }} />}
                                                                label="PK"
                                                                size="small"
                                                                sx={{ 
                                                                    height: 22,
                                                                    fontSize: 10,
                                                                    bgcolor: alpha(theme.palette.success.main, 0.15),
                                                                    color: "success.main",
                                                                    "& .MuiChip-icon": { color: "success.main" },
                                                                }}
                                                            />
                                                        )}
                                                        {fk && (
                                                            <Chip
                                                                icon={<LinkIcon sx={{ fontSize: "12px !important" }} />}
                                                                label={fk.foreignTable}
                                                                size="small"
                                                                sx={{ 
                                                                    height: 22,
                                                                    fontSize: 10,
                                                                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                                                                    color: "primary.main",
                                                                    "& .MuiChip-icon": { color: "primary.main" },
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {tableInfo.reverseForeignKeys?.length > 0 && (
                            <Box 
                                sx={{ 
                                    mt: 2, 
                                    p: 2, 
                                    bgcolor: alpha(theme.palette.secondary.main, 0.05),
                                    borderRadius: 2,
                                    border: 1,
                                    borderColor: alpha(theme.palette.secondary.main, 0.2),
                                }}
                            >
                                <Typography variant="caption" fontWeight={600} color="secondary.main" sx={{ mb: 1, display: "block" }}>
                                    Referenced By
                                </Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                                    {tableInfo.reverseForeignKeys.map((rfk, idx) => (
                                        <Chip
                                            key={idx}
                                            label={`${rfk.referencingTable}.${rfk.referencingColumn}`}
                                            size="small"
                                            sx={{ 
                                                height: 24,
                                                fontSize: 11,
                                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                                color: "secondary.main",
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}
