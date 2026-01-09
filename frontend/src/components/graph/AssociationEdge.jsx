import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';

// Simple association edge for UML diagrams, optionally with multiplicity label
const AssociationEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data }) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const label = data?.label || '';
  const sourceMult = data?.sourceMultiplicity || 'N';
  const targetMult = data?.targetMultiplicity || '1';

  const baseStyle = { fill: 'none', stroke: '#EF4444', strokeWidth: 4 };
  const mergedStyle = { ...baseStyle, ...(style || {}) };
  return (
    <g>
      {/* main association line */}
      <path id={id} d={edgePath} style={mergedStyle} />
      {/* multiplicity labels near endpoints */}
      <text x={sourceX + 6} y={sourceY - 6} fontSize={11} fill="#374151">{sourceMult}</text>
      <text x={targetX + 6} y={targetY - 6} fontSize={11} fill="#374151">{targetMult}</text>
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

export default React.memo(AssociationEdge);
