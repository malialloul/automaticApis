import { Grid, TextField, MenuItem } from "@mui/material";

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
  <>
    <Grid item xs={12} md={4}>
      <TextField
        select
        fullWidth
        size="small"
        label="Order By"
        value={orderBy}
        onChange={e => setOrderBy(e.target.value)}
      >
        {columns.map(c => (
          <MenuItem key={c.name} value={c.name}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
    </Grid>

    <Grid item xs={12} md={2}>
      <TextField
        select
        fullWidth
        size="small"
        label="Dir"
        value={orderDir}
        onChange={e => setOrderDir(e.target.value)}
      >
        <MenuItem value="ASC">ASC</MenuItem>
        <MenuItem value="DESC">DESC</MenuItem>
      </TextField>
    </Grid>

    <Grid item xs={12} md={3}>
      <TextField
        size="small"
        fullWidth
        label="Page Size"
        value={pageSize}
        onChange={e => setPageSize(e.target.value)}
      />
    </Grid>

    <Grid item xs={12} md={3}>
      <TextField
        size="small"
        fullWidth
        label="Page Number"
        value={pageNumber}
        onChange={e => setPageNumber(e.target.value)}
      />
    </Grid>
  </>
);

export default GetOptionsPanel;
