import React, { useEffect, useState } from 'react';

interface SensorSparklineProps {
  vehicleId: string;
  sensorType: string;
  token?: string;
  min: number;
  max: number;
}

export const SensorSparkline: React.FC<SensorSparklineProps> = ({ vehicleId, sensorType, token, min, max }) => {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) return;
      try {
        const res = await fetch(`http://localhost:3000/api/v1/sensors/history/${vehicleId}?sensorType=${sensorType}&period=1h`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const vals = data.map((d: any) => sensorType === 'temperature' ? Number(d.avg_temp) : Number(d.avg_hum)).filter((n: number) => !isNaN(n));
          setPoints(vals);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [vehicleId, sensorType, token]);

  if (points.length < 2) return <div className="h-full flex items-end justify-center text-xs text-textMuted/50">Sin historial</div>;

  const chartMin = Math.min(...points, min - 5);
  const chartMax = Math.max(...points, max + 5);
  
  const width = 200;
  const height = 40;

  const dx = width / (points.length - 1);
  const dy = height / (chartMax - chartMin || 1);

  const polylinePoints = points.map((p, i) => `${i * dx},${height - (p - chartMin) * dy}`).join(' ');
  const latestPoint = points[points.length - 1];
  
  // Safe zone rect
  const safeYTop = height - (max - chartMin) * dy;
  const safeYBottom = height - (min - chartMin) * dy;
  const safeHeight = Math.max(safeYBottom - safeYTop, 0);

  let strokeColor = '#00F59B';
  if (latestPoint < min) strokeColor = '#2AB3FF';
  if (latestPoint > max) strokeColor = '#FF9500';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <rect 
        x="0" 
        y={safeYTop} 
        width={width} 
        height={safeHeight} 
        fill="#00F59B" 
        opacity="0.1" 
      />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
    </svg>
  );
};
