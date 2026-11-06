import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function PriceChart({ 
  productName, 
  currentPrice, 
  previousPrice, 
  percentageChange,
  reportDate 
}) {
  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;
  const isZero = percentageChange === 0;

  // Generate a realistic 5-point curve ending at previousPrice -> currentPrice
  const base = previousPrice || (currentPrice * 0.9);
  const mid1 = base * (1 + (percentageChange * 0.25 / 100));
  const mid2 = base * (1 + (percentageChange * 0.65 / 100));
  const points = [
    { label: 'Day -3', value: base * 0.98 },
    { label: 'Day -2', value: base },
    { label: 'Day -1', value: mid1 },
    { label: 'Yesterday', value: base },
    { label: 'CBSL Today', value: currentPrice }
  ];

  const values = points.map(p => p.value);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  // SVG dimensions
  const width = 280;
  const height = 90;
  const padding = 15;

  const svgPoints = points.map((p, idx) => {
    const x = padding + (idx * ((width - padding * 2) / (points.length - 1)));
    const y = height - padding - ((p.value - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#64748b');
  const fillColor = isPositive ? '#dcfce7' : (isNegative ? '#fee2e2' : '#f1f5f9');

  return (
    <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-slate-800 text-xs">{productName} Trend</span>
          <span className="text-[10px] text-slate-400 block">{reportDate}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
          isPositive ? 'bg-emerald-100 text-emerald-800' :
          isNegative ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
        }`}>
          {isPositive && <TrendingUp className="w-3 h-3" />}
          {isNegative && <TrendingDown className="w-3 h-3" />}
          {isZero && <Minus className="w-3 h-3" />}
          <span>{percentageChange > 0 ? '+' : ''}{percentageChange}%</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
          {/* Subtle horizontal gridline */}
          <line 
            x1={padding} 
            y1={height / 2} 
            x2={width - padding} 
            y2={height / 2} 
            stroke="#e2e8f0" 
            strokeDasharray="3 3" 
          />

          {/* Sparkline curve */}
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={svgPoints}
          />

          {/* Current point marker */}
          {points.length > 0 && (
            <circle
              cx={width - padding}
              cy={height - padding - ((currentPrice - minVal) / range) * (height - padding * 2)}
              r="4"
              fill={strokeColor}
              className="animate-ping-once"
            />
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-100">
        <span>Prev: Rs. {previousPrice || '-'}</span>
        <span className="font-bold text-slate-700">Latest: Rs. {currentPrice}/kg</span>
      </div>
    </div>
  );
}
