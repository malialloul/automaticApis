import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

// Custom edge with crow's-foot marker on the target side and relationship label
const CrowsFootEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data }) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const label = data?.label || '';

  const footSize = 10;
  const strokeColor = style.stroke || '#8B5CF6';
  
  // Draw a simple crow's foot using three lines at the target end
  const foot = (
    <g>
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY - footSize} stroke={strokeColor} strokeWidth={2} />
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY + footSize} stroke={strokeColor} strokeWidth={2} />
      <line x1={targetX} y1={targetY} x2={targetX - footSize} y2={targetY} stroke={strokeColor} strokeWidth={2} />
    </g>
  );

  return (
    <g>
      {/* main relationship line */}
      <path 
        id={id} 
        d={edgePath} 
        style={{ 
          fill: 'none', 
          stroke: strokeColor, 
          strokeWidth: 2,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
        }} 
      />
      {/* crow's foot at parent (target) end indicates 1..* */}
      {foot}
      {/* source marker to clarify direction */}
      <circle cx={sourceX} cy={sourceY} r={4} fill={strokeColor} />
      {/* multiplicity labels near endpoints */}
      <text 
        x={sourceX + 8} 
        y={sourceY - 8} 
        fontSize={10} 
        fontWeight={600}
        fill="#8B5CF6"
      >
        N
      </text>
      <text 
        x={targetX + 8} 
        y={targetY - 8} 
        fontSize={10} 
        fontWeight={600}
        fill="#10B981"
      >
        1
      </text>
      {label && (
        <EdgeLabelRenderer>
          <div style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 500,
            color: '#8B5CF6',
            backdropFilter: 'blur(4px)',
          }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
};

export default React.memo(CrowsFootEdge);
