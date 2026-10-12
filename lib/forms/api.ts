import "server-only";
import { NextResponse } from "next/server";
import { getFormsSession } from "./auth";
import type { SessionUser } from "./types";

// Tiny route-handler wrapper for the authenticated Boardwalk Forms API.
// Every /api/forms/* handler (except the public/* endpoints) goes through
// this, so there is exactly one place where the session gate lives.

type Handler = (req: Request, session: SessionUser, params: Record<string, string>) => Promise<Response>;

export function withFormsAuth(handler: Handler) {
  return async (req: Request, ctx?: { params?: Promise<Record<string, string>> }): Promise<Response> => {
    const session = await getFormsSession();
    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const params = ctx?.params ? await ctx.params : {};
    try {
      return await handler(req, session, params);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message = status === 500 ? "Something went wrong. Try again." : (err as Error).message;
      if (status === 500) console.error("[forms-api]", err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function formsBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3001";
}
