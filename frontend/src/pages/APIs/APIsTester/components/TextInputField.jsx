import React, { useRef } from 'react';
import { Grid, TextField } from '@mui/material';

// Stable text input field to avoid losing focus during re-renders
const TextInputField = React.memo(({ col, value, onChange, disabled = false, type = 'text', label }) => {
    const inputRef = useRef(null);
    const handleChange = (e) => onChange && onChange(e.target.value);

    return (
        <Grid item xs={12} md={6}>
            <TextField
                fullWidth
                size="small"
                label={label || col?.name}
                type={type}
                inputRef={inputRef}
                value={value ?? ""}
                onChange={handleChange}
                disabled={disabled}
            />
        </Grid>
    );
}, (prev, next) => prev.value === next.value && prev.disabled === next.disabled);

export default TextInputField;
