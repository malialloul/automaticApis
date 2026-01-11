import { Grid, TextField } from "@mui/material";

const PostForm = ({ columns, bodyFields, setBodyFields, pk }) => (
  <>
    {columns.map(col => {
      if (col.name === pk) return null;
      if (col.name.toLowerCase().includes("password")) return null;

      return (
        <Grid item xs={12} md={6} key={col.name}>
          <TextField
            fullWidth
            size="small"
            label={col.name}
            value={bodyFields[col.name] ?? ""}
            onChange={e =>
              setBodyFields(b => ({ ...b, [col.name]: e.target.value }))
            }
          />
        </Grid>
      );
    })}
  </>
);

export default PostForm;
