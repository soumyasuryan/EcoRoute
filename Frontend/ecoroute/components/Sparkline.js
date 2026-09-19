'use client';

/**
 * Sparkline — lightweight 60x20px SVG inline AQI trend chart.
 * No external dependencies.
 * @param {number[]} data  - Array of AQI values (up to 8 entries)
 * @param {number} width   - Optional override (default 60)
 * @param {number} height  - Optional override (default 20)
 */
export default function Sparkline({ data = [], width = 60, height = 20 }) {
  // Need at least 2 points to draw a line
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 1.5;
  const innerH = height - pad * 2;
  const innerW = width - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Determine color from last value
  const last = data[data.length - 1];
  const color = last > 400 ? '#ef4444' : last > 200 ? '#f59e0b' : '#10b981';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`AQI trend: ${data.join(', ')}`}
      role="img"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
      />
      {/* Dot at the last data point */}
      {(() => {
        const lastPt = points[points.length - 1].split(',');
        return (
          <circle
            cx={parseFloat(lastPt[0])}
            cy={parseFloat(lastPt[1])}
            r={2}
            fill={color}
          />
        );
      })()}
    </svg>
  );
}
