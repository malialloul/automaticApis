import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, Alert } from '@mui/material';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { getSchema } from '../services/api';

const RelationshipGraph = ({ connectionId }) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    const loadSchema = async () => {
      if (!connectionId) return;

      try {
        const schema = await getSchema(connectionId);
        const tableNames = Object.keys(schema);
        
        // Create nodes for each table
        const newNodes = tableNames.map((tableName, index) => {
          const x = (index % 4) * 300;
          const y = Math.floor(index / 4) * 150;
          
          return {
            id: tableName,
            data: { 
              label: (
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {tableName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {schema[tableName].columns.length} cols
                  </Typography>
                </Box>
              ),
            },
            position: { x, y },
            style: {
              background: '#fff',
              border: '2px solid #1976d2',
              borderRadius: 8,
              padding: 10,
              minWidth: 150,
            },
          };
        });

        // Create edges for foreign key relationships
        const newEdges = [];
        let edgeId = 0;

        Object.entries(schema).forEach(([tableName, tableInfo]) => {
          tableInfo.foreignKeys?.forEach(fk => {
            newEdges.push({
              id: `e${edgeId++}`,
              source: tableName,
              target: fk.foreignTable,
              label: fk.columnName,
              animated: true,
              style: { stroke: '#1976d2' },
            });
          });
        });

        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Error loading schema:', err);
      }
    };

    loadSchema();
  }, [connectionId]);

  if (!connectionId) {
    return (
      <Alert severity="info">
        Please select a connection to view relationship graph
      </Alert>
    );
  }

  if (nodes.length === 0) {
    return (
      <Alert severity="warning">
        No tables found. Please introspect the database first.
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, height: '600px' }}>
      <Typography variant="h5" gutterBottom>
        Table Relationships
      </Typography>
      <Box sx={{ height: 'calc(100% - 50px)', border: '1px solid #ddd', borderRadius: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Box>
    </Paper>
  );
};

export default RelationshipGraph;
