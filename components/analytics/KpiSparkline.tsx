"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface KpiSparklineProps {
  data: number[];
  color?: string;
}

export function KpiSparkline({ data, color = "#FF8A65" }: KpiSparklineProps) {
  if (data.length === 0 || data.every((v) => v === 0)) {
    return <div style={{ height: 28, marginTop: 6 }} />;
  }

  const chartData = data.map((v) => ({ v }));

  return (
    <div style={{ width: "100%", height: 28, marginTop: 6 }}>
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
