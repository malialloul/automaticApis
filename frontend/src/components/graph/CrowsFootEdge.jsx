import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

// Custom edge with crow's-foot marker on the target side and relationship label
const CrowsFootEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data }) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const label = data?.label || '';

  const footSize = 10;
  // Draw a simple crow's foot using three lines at the target end
  const foot = (
    <g>
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY - footSize} stroke={style.stroke || '#374151'} strokeWidth={2} />
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY + footSize} stroke={style.stroke || '#374151'} strokeWidth={2} />
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY} stroke={style.stroke || '#374151'} strokeWidth={2} />
    </g>
  );

  return (
    <g>
      <path id={id} d={edgePath} style={{ fill: 'none', stroke: style.stroke || '#1976d2', strokeWidth: 2 }} />
      {foot}
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            color: '#374151',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
          }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
};

export default CrowsFootEdge;
