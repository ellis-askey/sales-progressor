// Tiny inline trend line for Command Centre stat tiles. Replaces the old
// per-day bar strips: instead of one shared "activity pulse" nobody could read,
// each metric carries its own 7-day-plus-today micro-trend right in its tile.
// Pure SVG, no dependency. Colour comes from the parent via currentColor.

export function Sparkline({
  values,
  width = 76,
  height = 20,
  className,
}: {
  /** Oldest to newest; the last point is emphasised with a dot. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(1, ...values);
  const pad = 2;
  const usableH = height - pad * 2;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const y = (v: number) => height - pad - (v / max) * usableH;

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = x(n - 1);
  const lastY = y(values[n - 1]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={1.9} fill="currentColor" />
    </svg>
  );
}
