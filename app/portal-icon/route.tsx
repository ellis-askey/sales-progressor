import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "96px",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="280"
          height="280"
          fill="none"
          stroke="white"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" fill-opacity="0.9" />
          <polyline points="9 22 9 12 15 12 15 22" stroke="rgba(255,138,101,0.8)" stroke-width="1.5" />
        </svg>
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
