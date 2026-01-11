    import { Grid, TextField, Typography, Divider } from "@mui/material";
import FiltersPanel from "./FiltersPanel";

const PutForm = ({
  columns,
  updateFields,
  setUpdateFields,
  updateConditions,
  setUpdateConditions,
  pk
}) => (
  <>
    <Grid item xs={12}>
      <Typography variant="subtitle2">Fields to Modify</Typography>
    </Grid>

    {columns.map(col => {
      if (col.name === pk) return null;

      return (
        <Grid item xs={12} md={6} key={col.name}>
          <input
            type="checkbox"
            checked={col.name in updateFields}
            onChange={e =>
              setUpdateFields(f => {
                const c = { ...f };
                e.target.checked ? (c[col.name] = "") : delete c[col.name];
                return c;
              })
            }
          />
          {col.name}

          {col.name in updateFields && (
            <TextField
              size="small"
              fullWidth
              value={updateFields[col.name]}
              onChange={e =>
                setUpdateFields(f => ({
                  ...f,
                  [col.name]: e.target.value
                }))
              }
            />
          )}
        </Grid>
      );
    })}

    <Grid item xs={12}>
      <Divider sx={{ my: 2 }} />
    </Grid>

    <FiltersPanel
      columns={columns}
      filters={updateConditions}
      setFilters={setUpdateConditions}
      title="Update Conditions"
    />
  </>
);

export default PutForm;
