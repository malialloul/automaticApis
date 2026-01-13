import React, { useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { Handle, Position } from 'reactflow';

// TableNode renders a box styled like an ERD table with PK/FK sections
const TableNode = ({ data }) => {
  const { tableName, columns = [], primaryKeys = [], foreignKeys = [], showColumns = false } = data || {};
  const fkSet = new Set((foreignKeys || []).map((f) => f.columnName));
  const pkSet = new Set(primaryKeys || []);

  const pkCols = columns.filter((c) => pkSet.has(c.name));
  const nonPkCols = columns.filter((c) => !pkSet.has(c.name));

  // Hover state for handles (store string ids like `${tableName}:${colName}:source`)
  const [hoveredHandle, setHoveredHandle] = useState(null);

  const hoverKey = (col, type) => `${tableName}:${col}:${type}`;
  const isHovered = (col, type) => hoveredHandle === hoverKey(col, type);

  return (
    <Box sx={{
      border: '1px solid #9EA3AE',
      borderRadius: 1,
      bgcolor: '#fff',
      minWidth: 220,
      boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    }}>
      <Box sx={{
        bgcolor: '#f3f4f6',
        borderBottom: '1px solid #e5e7eb',
        p: 1,
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827' }}>
          {tableName}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '36px 1fr', columnGap: 1 }}>
        <Box sx={{ borderRight: '1px solid #e5e7eb' }}>
          <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, color: '#6b7280' }}>PK</Typography>
          <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, color: '#6b7280' }}>FK</Typography>
        </Box>
        <Box>
          {/* PK list */}
          <Box sx={{ px: 1, py: 0.5 }}>
            {pkCols.length ? (
              pkCols.map((c) => (
                <Box key={c.name} sx={{ position: 'relative' }}>
                  {showColumns && (
                    <Typography variant="caption" sx={{ display: 'block', color: '#374151' }}>
                      {c.name}
                    </Typography>
                  )}
                  {/* Always render a target handle for PKs (they can be referenced by FKs) */}
                  <Tooltip title={c.name} placement="left">
                    <span
                      onMouseEnter={() => setHoveredHandle(hoverKey(c.name, 'target'))}
                      onMouseLeave={() => setHoveredHandle(null)}
                    >
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={`${tableName}:${c.name}`}
                        style={{
                          top: '50%',
                          transform: 'translateY(-50%)',
                          left: -6,
                          width: isHovered(c.name, 'target') ? 12 : 8,
                          height: isHovered(c.name, 'target') ? 12 : 8,
                          background: isHovered(c.name, 'target') ? '#374151' : '#6b7280',
                          border: '1px solid #374151',
                          transition: 'width 120ms, height 120ms, background 120ms',
                        }}
                      />
                    </span>
                  </Tooltip>
                  {/* If this PK is also an FK (common in join tables), render a source handle as well so we can attach outgoing edges from it */}
                  {fkSet.has(c.name) && (
                    <Tooltip title={c.name} placement="right">
                      <span
                        onMouseEnter={() => setHoveredHandle(hoverKey(c.name, 'source'))}
                        onMouseLeave={() => setHoveredHandle(null)}
                      >
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`${tableName}:${c.name}`}
                          style={{
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: -6,
                            width: isHovered(c.name, 'source') ? 12 : 8,
                            height: isHovered(c.name, 'source') ? 12 : 8,
                            background: isHovered(c.name, 'source') ? '#0369a1' : '#0ea5e9',
                            border: '1px solid #374151',
                            transition: 'width 120ms, height 120ms, background 120ms',
                          }}
                        />
                      </span>
                    </Tooltip>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="caption" sx={{ color: '#9CA3AF' }}>—</Typography>
            )}
          </Box>
          {/* FK and other columns */}
          <Box sx={{ px: 1, py: 0.5, borderTop: '1px solid #e5e7eb' }}>
            {nonPkCols.length ? (
              nonPkCols.map((c) => (
                <Box key={c.name} sx={{ position: 'relative' }}>
                  {showColumns && (
                    <Typography variant="caption" sx={{ display: 'block', color: fkSet.has(c.name) ? '#0ea5e9' : '#374151' }}>
                      {c.name}
                    </Typography>
                  )}
                  {fkSet.has(c.name) && (
                    <Tooltip title={c.name} placement="right">
                      <span
                        onMouseEnter={() => setHoveredHandle(hoverKey(c.name, 'source'))}
                        onMouseLeave={() => setHoveredHandle(null)}
                      >
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`${tableName}:${c.name}`}
                          style={{
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: -6,
                            width: isHovered(c.name, 'source') ? 12 : 8,
                            height: isHovered(c.name, 'source') ? 12 : 8,
                            background: isHovered(c.name, 'source') ? '#0369a1' : '#0ea5e9',
                            border: '1px solid #374151',
                            transition: 'width 120ms, height 120ms, background 120ms',
                          }}
                        />
                      </span>
                    </Tooltip>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="caption" sx={{ color: '#9CA3AF' }}>—</Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(TableNode);
