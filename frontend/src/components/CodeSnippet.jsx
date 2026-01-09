import React, { useState } from 'react';
import {
  Box,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { generateCodeSnippet, LANGUAGE_OPTIONS } from '../utils/codeGenerator';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

const CodeSnippet = ({ endpoint, options }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript-fetch');
  const [copied, setCopied] = useState(false);

  const code = generateCodeSnippet(endpoint, selectedLanguage, options);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
  };

  const handleCloseSnackbar = () => {
    setCopied(false);
  };

  const getLanguageForHighlighting = (lang) => {
    if (lang. startsWith('javascript')) return 'javascript';
    if (lang.startsWith('python')) return 'python';
    if (lang.startsWith('php')) return 'php';
    if (lang.startsWith('java')) return 'java';
    if (lang.startsWith('csharp')) return 'csharp';
    if (lang. startsWith('go')) return 'go';
    if (lang. startsWith('ruby')) return 'ruby';
    if (lang.startsWith('swift')) return 'swift';
    if (lang.startsWith('kotlin')) return 'kotlin';
    if (lang === 'curl') return 'bash';
    return 'javascript';
  };

  return (
    <Paper elevation={2} sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          bgcolor: 'grey.800',
          borderBottom: '1px solid',
          borderColor: 'grey.700',
        }}
      >
        <FormControl sx={{ minWidth: 250 }} size="small">
          <InputLabel sx={{ color: 'white' }}>Language / Framework</InputLabel>
          <Select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target. value)}
            label="Language / Framework"
            sx={{
              color: 'white',
              '. MuiOutlinedInput-notchedOutline': {
                borderColor: 'grey.600',
              },
              '&:hover . MuiOutlinedInput-notchedOutline': {
                borderColor: 'grey. 500',
              },
              '&.Mui-focused . MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
              },
              '. MuiSvgIcon-root': {
                color: 'white',
              },
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option. icon} {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
          onClick={handleCopy}
          color={copied ? 'success' : 'primary'}
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
      </Box>

      <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
        <SyntaxHighlighter
          language={getLanguageForHighlighting(selectedLanguage)}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            fontSize: '14px',
            padding: '20px',
          }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%' }}
        >
          Code copied to clipboard!
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default CodeSnippet;