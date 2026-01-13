import { Box, Typography, Skeleton, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Button, Chip } from "@mui/material"
import LinkOffIcon from "@mui/icons-material/LinkOff";
import DeleteIcon from "@mui/icons-material/Delete";
import { useConnection } from "../../../_shared/database/useConnection";
import { useNavigate } from "react-router-dom";

export const DatabaseBreakdown = ({ refreshSchemas, connections, scope, statsById, loadingStats, setConfirm }) => {
    const { currentConnection, selectConnection } = useConnection();
    const navigate = useNavigate();
    return (
        <>
            <Typography sx={{ mt: 4, mb: 2, color: "#F1F5F9", fontSize: 20, fontWeight: 600 }}>{scope === 'all' ? 'Connected Databases' : 'Selected Database'}</Typography>
            <TableContainer>
                {connections.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center", color: "#94A3B8" }}>No connections</Box>
                ) : (
                    <Table size="small" sx={{ minWidth: 1200 }}>
                        <TableHead>
                            <TableRow sx={{ borderBottom: '1px solid #334155' }}>
                                {[
                                    "Database",
                                    "Type",
                                    "Tables",
                                    "APIs",
                                    "Status",
                                    "Actions",
                                ].map((h, i) => (
                                    <TableCell key={i} sx={{ color: "#94A3B8", fontWeight: 600, fontSize: 13 }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(scope === 'current' && currentConnection
                                ? connections.filter((c) => c.id === currentConnection.id)
                                : connections
                                    .slice()
                                    .sort((a, b) => {
                                        if (!currentConnection?.id) return 0;
                                        const aIsCurrent = a.id === currentConnection.id;
                                        const bIsCurrent = b.id === currentConnection.id;
                                        if (aIsCurrent && !bIsCurrent) return -1;
                                        if (!aIsCurrent && bIsCurrent) return 1;
                                        return 0;
                                    })
                            ).map((c) => (
                                <TableRow
                                    key={c.id}
                                    hover
                                    onClick={() => selectConnection(c)}
                                    sx={{ cursor: 'pointer', bgcolor: currentConnection?.id === c.id ? '#273244' : undefined, '&:hover': { bgcolor: currentConnection?.id === c.id ? '#273244' : '#334155' } }}
                                >
                                    <TableCell>
                                        <Box>
                                            <Typography sx={{ color: "#F8FAFC", fontSize: 14, fontWeight: 500 }}>
                                                {c.name || c.database}
                                            </Typography>
                                            <Typography sx={{ color: "#94A3B8", fontSize: 12 }}>{c.host}:{c.port}</Typography>
                                            {statsById[c.id] === undefined && !loadingStats && (
                                                <Typography sx={{ color: "#64748B", fontSize: 12, mt: 0.5 }}>Introspect to view stats</Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={c.type || c.dbType || "Unknown"} size="small" sx={{ bgcolor: "#3B82F6", color: "white" }} />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ color: "#F8FAFC", fontSize: 14 }}>
                                            {loadingStats && statsById[c.id] === undefined ? (
                                                <Skeleton variant="text" width={24} />
                                            ) : (
                                                statsById[c.id]?.tableCount ?? "—"
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ color: "#8B5CF6", fontSize: 14 }}>
                                            {loadingStats && statsById[c.id] === undefined ? (
                                                <Skeleton variant="text" width={24} />
                                            ) : (
                                                statsById[c.id]?.endpointCount ?? "—"
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: (scope === 'all' ? (currentConnection?.id === c.id ? "#10B981" : "#64748B") : "#10B981") }} />
                                            <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                                                {scope === 'all' ? (currentConnection?.id === c.id ? 'Connected' : 'Available') : 'Connected'}
                                            </Typography>
                                        </Box>
                                    </TableCell>

                                    <TableCell>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <Tooltip title="Disconnect">
                                                <span>
                                                    <Button size="small" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirm({ open: true, type: 'disconnect', target: c });
                                                    }} sx={{ bgcolor: "#334155" }}>
                                                        <LinkOffIcon fontSize="small" />
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Refresh schema">
                                                <span>
                                                    <Button size="small" onClick={(e) => { e.stopPropagation(); refreshSchemas([c.id]); }} sx={{ bgcolor: "#334155", minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {'🔄'}
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="View details">
                                                <span>
                                                    <Button size="small" onClick={(e) => { e.stopPropagation(); navigate("/schema"); }} sx={{ bgcolor: "#334155" }}>👁️</Button>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <span>
                                                    <Button size="small" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirm({ open: true, type: 'delete', target: c });
                                                    }} sx={{ bgcolor: "#334155" }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </TableContainer>
        </>
    )
}