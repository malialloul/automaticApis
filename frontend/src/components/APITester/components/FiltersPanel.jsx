import { Grid, TextField, MenuItem, Typography } from "@mui/material";

const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "contains", label: "contains" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
];

const FiltersPanel = ({ columns, filters, setFilters, title }) => {
  return (
    <>
      <Grid item xs={12}>
        <Typography variant="subtitle2">{title}</Typography>
      </Grid>

      {columns.map(col => (
        <Grid container spacing={1} item xs={12} md={6} key={col.name}>
          <Grid item xs={4}>
            <TextField
              select
              size="small"
              fullWidth
              value={filters[col.name]?.op || "eq"}
              onChange={(e) =>
                setFilters(f => ({
                  ...f,
                  [col.name]: { ...(f[col.name] || {}), op: e.target.value }
                }))
              }
            >
              {OPERATORS.map(o => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={8}>
            <TextField
              size="small"
              fullWidth
              label={col.name}
              value={filters[col.name]?.val || ""}
              onChange={(e) =>
                setFilters(f => ({
                  ...f,
                  [col.name]: { ...(f[col.name] || {}), val: e.target.value }
                }))
              }
            />
          </Grid>
        </Grid>
      ))}
    </>
  );
};

export default FiltersPanel;
