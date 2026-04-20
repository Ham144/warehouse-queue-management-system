const SparklineChart = ({ data, title, color = "blue" }) => {
  if (!data || data.length === 0) return null;

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  // Chart colors
  const colorMap = {
    blue: { stroke: "#3b82f6", fill: "url(#fill-blue)" },
    emerald: { stroke: "#10b981", fill: "url(#fill-emerald)" },
    amber: { stroke: "#f59e0b", fill: "url(#fill-amber)" },
  };

  const selectedColor = colorMap[color] || colorMap.blue;

  // SVG dimensions
  const width = 200;
  const height = 100;
  const padding = 10;

  // Generate points for the path
  const points = data.map((point, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = (height - padding) - ((point.value - minValue) / range) * (height - 2 * padding);
    return { x, y };
  });

  const pathData = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaData = pathData + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{title}</h4>
      
      <div className="relative h-24 w-full">
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="fill-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fill-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fill-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path d={areaData} fill={selectedColor.fill} />
          <path d={pathData} fill="none" stroke={selectedColor.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex justify-between mt-2">
        {data.filter((_, i) => i % 2 === 0).map((point, i) => (
          <span key={i} className="text-[10px] text-gray-400 font-medium">
            {point.time}
          </span>
        ))}
      </div>
    </div>
  );
};

export default SparklineChart;
