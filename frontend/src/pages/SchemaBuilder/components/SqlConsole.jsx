import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { schemaBuilder } from '../../../services/api';

const SqlConsole = ({ connectionId, onExecuted }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem(`sql_history_${connectionId}`);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, [connectionId]);

  const saveToHistory = (query) => {
    const newHistory = [
      { sql: query, timestamp: new Date().toISOString() },
      ...history.filter(h => h.sql !== query).slice(0, 19),
    ];
    setHistory(newHistory);
    localStorage.setItem(`sql_history_${connectionId}`, JSON.stringify(newHistory));
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const res = await schemaBuilder.executeSql(connectionId, sql);
      setResult(res);
      saveToHistory(sql);
      if (onExecuted) onExecuted();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newValue = sql.substring(0, start) + '  ' + sql.substring(end);
      setSql(newValue);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleLoadFromHistory = (historySql) => {
    setSql(historySql);
    textareaRef.current?.focus();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      {/* Main Editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">SQL Console</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Copy SQL">
              <IconButton size="small" onClick={handleCopy} disabled={!sql}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear">
              <IconButton size="small" onClick={() => { setSql(''); setResult(null); setError(null); }}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Paper 
          variant="outlined" 
          sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 300,
          }}
        >
          <Box
            component="textarea"
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL statement...&#10;&#10;Press Ctrl+Enter to execute"
            sx={{
              flex: 1,
              p: 2,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'monospace',
              fontSize: 14,
              lineHeight: 1.6,
              bgcolor: 'grey.900',
              color: 'grey.100',
              '&::placeholder': {
                color: 'grey.500',
              },
            }}
          />
          
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: isDark ? 'grey.800' : 'grey.50' }}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
              onClick={handleExecute}
              disabled={loading || !sql.trim()}
              size="small"
            >
              Execute
            </Button>
            <Typography variant="caption" color="text.secondary">
              Ctrl+Enter to run
            </Typography>
          </Box>
        </Paper>

        {/* Results */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Paper variant="outlined" sx={{ mt: 2, overflow: 'auto', maxHeight: 300 }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'success.light' }}>
              <Typography variant="body2" color="success.contrastText">
                ✓ Query executed successfully
                {result.rowCount !== undefined && ` · ${result.rowCount} row(s) affected`}
              </Typography>
            </Box>
            
            {result.rows && result.rows.length > 0 && (
              <Box sx={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: isDark ? '#333' : '#f5f5f5' }}>
                      {Object.keys(result.rows[0]).map(key => (
                        <th key={key} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${isDark ? '#555' : '#ddd'}`, fontWeight: 600, color: isDark ? '#fff' : 'inherit' }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? (isDark ? '#1e1e1e' : 'white') : (isDark ? '#252525' : '#fafafa') }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#444' : '#eee'}`, color: isDark ? '#e0e0e0' : 'inherit' }}>
                            {val === null ? <span style={{ color: isDark ? '#888' : '#999', fontStyle: 'italic' }}>NULL</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {/* History Sidebar */}
      <Paper 
        variant="outlined" 
        sx={{ 
          width: 280, 
          display: 'flex', 
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" />
          <Typography variant="subtitle2">Query History</Typography>
          <Chip size="small" label={history.length} sx={{ ml: 'auto' }} />
        </Box>
        <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
          {history.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No queries yet
              </Typography>
            </Box>
          ) : (
            history.map((item, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleLoadFromHistory(item.sql)}
                sx={{ 
                  borderBottom: 1, 
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemText
                  primary={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: 11,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.sql.substring(0, 50)}
                      {item.sql.length > 50 && '...'}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </Typography>
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default SqlConsole;
