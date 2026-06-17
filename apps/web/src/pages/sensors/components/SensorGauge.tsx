import React from 'react';

interface SensorGaugeProps {
  value: number;
  min: number;
  max: number;
  safeMin: number;
  safeMax: number;
  colorHex: string;
}

export const SensorGauge: React.FC<SensorGaugeProps> = ({ value, min, max, safeMin, safeMax, colorHex }) => {
  // SVG arc calculation for a semicircle (180 degrees)
  const radius = 40;
  const strokeWidth = 8;
  const cx = 50;
  const cy = 45;

  const clamp = (val: number, mn: number, mx: number) => Math.min(Math.max(val, mn), mx);
  const percent = (clamp(value, min, max) - min) / (max - min);
  const angle = percent * 180;
  
  // Convert angle to radians
  const rad = (180 - angle) * Math.PI / 180;
  
  // Calculate end point for the value arc
  const endX = cx + radius * Math.cos(rad);
  const endY = cy - radius * Math.sin(rad);

  // Safe zone calculation
  const safeStartPct = (safeMin - min) / (max - min);
  const safeEndPct = (safeMax - min) / (max - min);
  
  const safeStartRad = (180 - (safeStartPct * 180)) * Math.PI / 180;
  const safeEndRad = (180 - (safeEndPct * 180)) * Math.PI / 180;

  const safeStartX = cx + radius * Math.cos(safeStartRad);
  const safeStartY = cy - radius * Math.sin(safeStartRad);
  const safeEndX = cx + radius * Math.cos(safeEndRad);
  const safeEndY = cy - radius * Math.sin(safeEndRad);

  return (
    <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
      {/* Background Arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#374151" // borderDefault equivalent
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      
      {/* Safe Zone Arc */}
      <path
        d={`M ${safeStartX} ${safeStartY} A ${radius} ${radius} 0 0 1 ${safeEndX} ${safeEndY}`}
        fill="none"
        stroke="#00F59B" // accentGreen
        strokeWidth={strokeWidth}
        opacity={0.3}
      />

      {/* Value Arc */}
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`}
        fill="none"
        stroke={colorHex}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Needle Marker */}
      <circle cx={endX} cy={endY} r="4" fill="#FFFFFF" />
      <circle cx={endX} cy={endY} r="2" fill={colorHex} />
    </svg>
  );
};
