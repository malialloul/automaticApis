import { Box, TextField, MenuItem, Select, Autocomplete, Tooltip, Typography, CircularProgress } from '@mui/material';

export function formatRowSummary(row, valKey) {
  if (!row || typeof row !== 'object') return '';
  const pairs = [];
  for (const k of Object.keys(row)) {
    if (k === valKey) continue;
    const v = row[k];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    pairs.push(`${k}: ${String(v)}`);
    if (pairs.length >= 3) break;
  }
  return pairs.join(' • ');
}

/**
 * Return primary key columns for `tableName` that are not also foreign keys
 * @param {object} schema - full schema object
 * @param {string} tableName
 * @returns {Array<string>}
 */
export function getNonFkPrimaryKeys(schema, tableName) {
  if (!schema || !tableName) return [];
  const table = schema[tableName];
  if (!table) return [];
  const pks = table.primaryKeys || [];
  const fks = (table.foreignKeys || []).map(f => f.columnName);
  return pks.filter(pk => !fks.includes(pk));
}

export function renderColumnControl({
  col,
  value,
  onChange,
  schema = {},
  tableName = null,
  foreignKeyOptions = {},
  size = 'small',
  fullWidth = true,
  disabled = false,
}) {
  const colName = col.name || '';
  const type = (col.type || '').toLowerCase();

  // Foreign key handling
  const fks = (schema[tableName]?.foreignKeys || []);
  const fk = fks.find((f) => f.columnName === col.name);
  if (fk) {
    const rawOpts = foreignKeyOptions[col.name];
    const loading = rawOpts === undefined;
    const opts = Array.isArray(rawOpts) ? rawOpts : [];
    const valKey = fk.foreignColumn || fk.foreign_column || 'id';

    if (rawOpts === undefined) {
      return (
        <TextField
          fullWidth={fullWidth}
          size={size}
          label={col.name}
          value={value ?? ''}
          disabled
          helperText="Loading..."
        />
      );
    }

    if (opts.length === 0) {
      return (
        <TextField
          fullWidth={fullWidth}
          size={size}
          label={col.name}
          value={value ?? ''}
          disabled
          helperText="No options"
        />
      );
    }

    const selectedOption = opts.find((r) => String(r[valKey] ?? r[Object.keys(r || {})[0]] ?? '') === String(value ?? '')) || null;

    return (
      <Autocomplete
        size={size}
        options={opts}
        loading={loading}
        noOptionsText={loading ? 'Loading...' : 'No options'}
        getOptionLabel={(row) => {
          const primary = row[valKey] ?? row[Object.keys(row || {})[0]] ?? '';
          const summary = formatRowSummary(row, valKey);
          return primary ? (summary ? `${primary} — ${summary}` : String(primary)) : JSON.stringify(row);
        }}
        filterOptions={(options, state) => {
          const q = state.inputValue.toLowerCase();
          return options.filter((r) => {
            const primary = String(r[valKey] ?? Object.values(r || {})[0] ?? '').toLowerCase();
            if (primary.includes(q)) return true;
            return Object.values(r || {}).some((v) => String(v ?? '').toLowerCase().includes(q));
          });
        }}
        value={selectedOption}
        onChange={(e, newVal) => {
          const v = newVal ? (newVal[valKey] ?? newVal[Object.keys(newVal || {})[0]] ?? '') : '';
          onChange && onChange(v);
        }}
        isOptionEqualToValue={(opt, valOpt) => {
          const ov = opt ? (opt[valKey] ?? opt[Object.keys(opt || {})[0]] ?? '') : '';
          const vv = valOpt ? (valOpt[valKey] ?? valOpt[Object.keys(valOpt || {})[0]] ?? '') : '';
          return String(ov) === String(vv);
        }}
        renderOption={(props, row) => {
          const { fullWidth, size, indicator, ...rest } = props;
          return (
            <li {...rest}>
              <Tooltip title={<pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(row, null, 2)}</pre>} placement="right">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2">{String(row[valKey] ?? Object.values(row || {})[0] ?? '')}</Typography>
                  {formatRowSummary(row, valKey) ? <Typography variant="caption" color="text.secondary">{formatRowSummary(row, valKey)}</Typography> : null}
                </Box>
              </Tooltip>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth={fullWidth}
            size={size}
            label={col.name}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        sx={{ flex: 1 }}
      />
    );
  }

  // Password
  if (colName.toLowerCase().includes('password')) {
    return <TextField fullWidth={fullWidth} size={size} type="password" label={col.name} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} disabled={disabled} />;
  }

  // Email
  if (colName.toLowerCase().includes('email')) {
    return <TextField fullWidth={fullWidth} size={size} type="email" label={col.name} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} disabled={disabled} />;
  }

  // Number
  if (["int", "integer", "bigint", "smallint", "numeric", "decimal", "float", "double", "real"].some((t) => type.includes(t))) {
    return <TextField fullWidth={fullWidth} size={size} type="number" label={col.name} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} disabled={disabled} />;
  }

  // Boolean
  if (["bool", "boolean"].some((t) => type.includes(t))) {
    return (
      <Select fullWidth={fullWidth} size={size} value={value === '' ? '' : Boolean(value)} onChange={(e) => onChange && onChange(e.target.value === 'true' || e.target.value === true)}>
        <MenuItem value="">Unset</MenuItem>
        <MenuItem value={true}>True</MenuItem>
        <MenuItem value={false}>False</MenuItem>
      </Select>
    );
  }

  // Enum
  if (Array.isArray(col.enumOptions) && col.enumOptions.length > 0) {
    return (
      <Select fullWidth={fullWidth} size={size} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)}>
        {col.enumOptions.map((ev) => (
          <MenuItem key={ev} value={ev}>
            {ev}
          </MenuItem>
        ))}
      </Select>
    );
  }

  // Date / datetime
  if (["date", "timestamp", "datetime"].some((t) => type.includes(t))) {
    // let caller decide between date-only or datetime-local if needed
    return <TextField fullWidth={fullWidth} size={size} type="datetime-local" label={col.name} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} InputLabelProps={{ shrink: true }} disabled={disabled} />;
  }

  // Default text
  return <TextField fullWidth={fullWidth} size={size} label={col.name} value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value)} disabled={disabled} />;
}
