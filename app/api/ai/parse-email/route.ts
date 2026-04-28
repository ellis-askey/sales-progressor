import { NextResponse } from "next/server";

// Feature temporarily disabled — privacy review in progress.
// The email parser sends third-party correspondence (solicitor emails) to Anthropic
// without the third party's knowledge. Returning to service once consent + redaction
// flow is designed.
export async function POST() {
  return NextResponse.json(
    { error: "This feature is temporarily unavailable." },
    { status: 503 }
  );
}
