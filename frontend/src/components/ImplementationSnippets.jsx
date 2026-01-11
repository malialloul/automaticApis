import React, { useEffect, useMemo, useState } from 'react';
import { Paper, Box, Typography, FormControl, InputLabel, Select, MenuItem, Stack, IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getSchema } from '../services/api';
import { BACKEND_LANGUAGE_OPTIONS, generateBackendSnippet } from '../utils/codeGenerator.jsx';

const METHOD_TO_LANG = {
  GET: 'express',
  POST: 'express',
  PUT: 'express',
  DELETE: 'express',
  // Extend as needed for other backend frameworks
};

const ImplementationSnippets = ({ connectionId, endpoint }) => {
  const [schema, setSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedLang, setSelectedLang] = useState(BACKEND_LANGUAGE_OPTIONS[0]?.value || 'express');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSchema(null);
    setTables([]);
    setSelectedTable('');
    setCode('');
    setError(null);
    if (!connectionId) return;
    (async () => {
      try {
        const s = await getSchema(connectionId);
        setSchema(s || {});
        const t = Object.keys(s || {}).sort();
        setTables(t);
        // If endpoint provided, prefer its table and method
        if (endpoint?.table) {
          setSelectedTable(endpoint.table);
        } else if (t.length) setSelectedTable(t[0]);
        // If endpoint has a method, set the language/method accordingly
        if (endpoint?.method) {
          const methodLang = METHOD_TO_LANG[endpoint.method.toUpperCase()] || BACKEND_LANGUAGE_OPTIONS[0]?.value || 'express';
          setSelectedLang(methodLang);
        }
      } catch (e) {
        setError(e?.message || 'Failed to load schema. Introspect the database first.');
      }
    })();
  }, [connectionId, endpoint]);

  useEffect(() => {
    if (!schema || !selectedTable || !selectedLang) { setCode(''); return; }
    try {
      // Use endpoint.method if available, else default to GET
      const method = endpoint?.method || 'GET';
      const snippet = generateBackendSnippet(schema, selectedTable, selectedLang, method , endpoint);
      setCode(snippet);
    } catch (e) {
      setCode('// Error generating snippet: ' + (e?.message || 'Unknown error'));
    }
  }, [schema, selectedTable, selectedLang, endpoint]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {}
  };

  const langMenu = useMemo(() => BACKEND_LANGUAGE_OPTIONS.map(opt => (
    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
  )), []);

  const tableMenu = useMemo(() => tables.map(t => (
    <MenuItem key={t} value={t}>{t}</MenuItem>
  )), [tables]);

  const theme = useTheme();
  const codeBg = theme.palette.mode === 'dark' ? 'grey.900' : '#f7fafc';

  return (
    <Paper elevation={3} sx={{ p: 3, bgcolor: theme.palette.background.paper }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Implementation Code Snippets</Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
      

        <FormControl fullWidth>
          <InputLabel id="lang-label">Language</InputLabel>
          <Select
            labelId="lang-label"
            label="Language"
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
          >
            {langMenu}
          </Select>
        </FormControl>

        <Tooltip title="Copy to clipboard">
          <span>
            <IconButton onClick={handleCopy} disabled={!code}>
              <ContentCopyIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{
        bgcolor: codeBg,
        color: theme.palette.text.primary,
        borderRadius: 1,
        p: 2,
        fontFamily: 'Monaco, Menlo, Consolas, "Courier New", monospace',
        fontSize: 12,
        overflowX: 'auto',
        minHeight: 200,
      }}>
        <pre style={{ margin: 0 }}><code>{code}</code></pre>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Paper>
  );
};

export default ImplementationSnippets;
