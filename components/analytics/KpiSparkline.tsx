"use client";

import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

interface KpiSparklineProps {
  data: number[];
  labels?: string[];
  color?: string;
}

export function KpiSparkline({ data, labels, color = "#FF8A65" }: KpiSparklineProps) {
  if (data.length === 0 || data.every((v) => v === 0)) {
    return <div style={{ height: 28, marginTop: 6 }} />;
  }

  const chartData = data.map((v) => ({ v }));

  return (
    <div style={{ width: "100%", height: 28, marginTop: 6 }}>
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 4, left: 6 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div style={{
                  background: "rgba(20,10,5,0.80)",
                  backdropFilter: "blur(6px)",
                  color: "#fff",
                  fontSize: 11,
                  padding: "5px 9px",
                  borderRadius: 7,
                  lineHeight: 1.4,
                  pointerEvents: "none",
                }}>
                  {labels?.[Number(label)] && (
                    <div style={{ opacity: 0.65, fontSize: 10 }}>{labels[Number(label)]}</div>
                  )}
                  <div style={{ fontWeight: 700 }}>{payload[0].value}</div>
                </div>
              );
            }}
            cursor={{ stroke: "rgba(0,0,0,0.10)", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
