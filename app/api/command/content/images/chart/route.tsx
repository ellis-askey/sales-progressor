import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const W = 1200;
const H = 628;

const CORAL = "#FF6B4A";
const CORAL_LIGHT = "#FFAA7A";

const DARK_BG = "#111111";
const LIGHT_BG = "#FFF8F5";

function weekLabel(offsetWeeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetWeeks * 7);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function barColor(i: number, isDark: boolean): string {
  const alphas = [1, 0.75, 0.5, 0.3];
  const a = alphas[i] ?? 0.3;
  if (isDark) return `rgba(255,107,74,${a})`;
  return `rgba(255,107,74,${a})`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant") ?? "dark";
  const metric = searchParams.get("metric") ?? "milestones";
  const isDark = variant !== "light";

  const bg = isDark ? DARK_BG : LIGHT_BG;
  const textColor = isDark ? "#f5f5f5" : "#2D1810";
  const mutedColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(45,24,16,0.45)";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(45,24,16,0.06)";

  let chartData: { label: string; value: number }[] = [];
  let chartTitle = "";

  if (metric === "pipeline") {
    const [active, onHold, completed, withdrawn] = await Promise.all([
      prisma.propertyTransaction.count({ where: { status: "active" } }),
      prisma.propertyTransaction.count({ where: { status: "on_hold" } }),
      prisma.propertyTransaction.count({ where: { status: "completed" } }),
      prisma.propertyTransaction.count({ where: { status: "withdrawn" } }),
    ]);
    chartData = [
      { label: "Active", value: active },
      { label: "On hold", value: onHold },
      { label: "Completed", value: completed },
      { label: "Withdrawn", value: withdrawn },
    ];
    chartTitle = "Transaction pipeline";
  } else {
    // milestones — last 4 weeks
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);

    const completions = await prisma.milestoneCompletion.findMany({
      where: {
        state: "complete",
        completedAt: { gte: fourWeeksAgo },
      },
      select: { completedAt: true },
    });

    const weeks = Array.from({ length: 4 }, (_, i) => {
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 7);
      return { start, end, label: weekLabel(3 - i) };
    }).reverse();

    chartData = weeks.map((week) => ({
      label: week.label,
      value: completions.filter(
        (c) => c.completedAt && c.completedAt >= week.start && c.completedAt < week.end
      ).length,
    }));
    chartTitle = "Milestones hit — last 4 weeks";
  }

  const maxValue = Math.max(...chartData.map((d) => d.value), 1);
  const BAR_MAX_H = 240;
  const BAR_W = metric === "pipeline" ? 140 : 160;
  const BAR_GAP = metric === "pipeline" ? 40 : 52;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 80px 52px",
          background: bg,
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Accent left stripe */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4,
            height: "100%",
            background: `linear-gradient(180deg, ${CORAL} 0%, transparent 100%)`,
            opacity: isDark ? 0.6 : 0.4,
          }}
        />

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: textColor, letterSpacing: "-0.02em" }}>
            {chartTitle}
          </span>
          <div
            style={{
              height: 1,
              flex: 1,
              background: gridColor,
              marginTop: 2,
            }}
          />
        </div>

        {/* Chart area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "flex-end",
            justifyContent: "center",
            gap: BAR_GAP,
            paddingBottom: 8,
            paddingTop: 16,
          }}
        >
          {chartData.map((d, i) => {
            const barH = Math.max(8, Math.round((d.value / maxValue) * BAR_MAX_H));
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  paddingBottom: 4,
                }}
              >
                {/* Value above bar */}
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: textColor,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {d.value}
                </span>

                {/* Bar */}
                <div
                  style={{
                    width: BAR_W,
                    height: barH,
                    background:
                      i === 0
                        ? `linear-gradient(180deg, ${CORAL_LIGHT}, ${CORAL})`
                        : barColor(i, isDark),
                    borderRadius: "6px 6px 0 0",
                  }}
                />

                {/* Label below bar */}
                <span
                  style={{
                    fontSize: 17,
                    color: mutedColor,
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                  }}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: isDark ? "rgba(255,255,255,0.5)" : CORAL,
              letterSpacing: "-0.01em",
            }}
          >
            Sales Progressor
          </span>
          <span style={{ fontSize: 13, color: mutedColor, letterSpacing: "0.02em" }}>
            portal.thesalesprogressor.co.uk
          </span>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
