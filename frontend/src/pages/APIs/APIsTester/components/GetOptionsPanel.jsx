import { Box, TextField, MenuItem, Stack } from "@mui/material";
import SortIcon from "@mui/icons-material/Sort";

const GetOptionsPanel = ({
  columns,
  orderBy,
  setOrderBy,
  orderDir,
  setOrderDir,
  pageSize,
  setPageSize,
  pageNumber,
  setPageNumber
}) => (
  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
    <TextField
      select
      size="small"
      label="Order By"
      value={orderBy}
      onChange={e => setOrderBy(e.target.value)}
      sx={{ 
        minWidth: 160,
        "& .MuiOutlinedInput-root": { borderRadius: 2 },
      }}
    >
      <MenuItem value="">
        <em>None</em>
      </MenuItem>
      {columns.map(c => (
        <MenuItem key={c.name} value={c.name}>
          {c.name}
        </MenuItem>
      ))}
    </TextField>

    <TextField
      select
      size="small"
      label="Direction"
      value={orderDir}
      onChange={e => setOrderDir(e.target.value)}
      sx={{ 
        minWidth: 100,
        "& .MuiOutlinedInput-root": { borderRadius: 2 },
      }}
    >
      <MenuItem value="ASC">ASC</MenuItem>
      <MenuItem value="DESC">DESC</MenuItem>
    </TextField>

    <TextField
      size="small"
      label="Page Size"
      value={pageSize}
      onChange={e => setPageSize(e.target.value)}
      type="number"
      sx={{ 
        minWidth: 100,
        "& .MuiOutlinedInput-root": { borderRadius: 2 },
      }}
    />

    <TextField
      size="small"
      label="Page"
      value={pageNumber}
      onChange={e => setPageNumber(e.target.value)}
      type="number"
      sx={{ 
        minWidth: 80,
        "& .MuiOutlinedInput-root": { borderRadius: 2 },
      }}
    />
  </Stack>
);

export default GetOptionsPanel;
