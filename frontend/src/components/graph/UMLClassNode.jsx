import React from 'react';
import { Box, Typography } from '@mui/material';

// UMLClassNode renders a UML-style class box with attributes
const UMLClassNode = ({ data }) => {
  const { tableName, columns = [], primaryKeys = [], showAttributes = true } = data || {};
  const pkSet = new Set(primaryKeys || []);

  const stereotype = data?.stereotype || '<<entity>>';
  return (
    <Box sx={{
      border: '1px solid #9EA3AE',
      borderRadius: 1,
      bgcolor: '#fff',
      minWidth: 240,
      boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    }}>
      <Box sx={{
        bgcolor: '#0b5cab',
        color: '#ffffff',
        borderBottom: '1px solid #0a4e93',
        p: 1,
      }}>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', opacity: 0.9 }}>
          {stereotype}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center' }}>
          {tableName}
        </Typography>
      </Box>

      <Box sx={{ p: 1 }}>
        {showAttributes ? (
          columns.length ? (
            columns.map((c) => (
              <Typography key={c.name} variant="caption" sx={{ display: 'block', color: '#374151' }}>
                {pkSet.has(c.name) ? '<PK> ' : ''}{c.name}{c.type ? `: ${c.type}` : ''}
              </Typography>
            ))
          ) : (
            <Typography variant="caption" sx={{ color: '#9CA3AF' }}>—</Typography>
          )
        ) : (
          <Typography variant="caption" sx={{ color: '#9CA3AF' }}>attributes hidden</Typography>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(UMLClassNode);
