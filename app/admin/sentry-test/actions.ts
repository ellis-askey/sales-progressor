"use server";

import { requireSession } from "@/lib/session";

export async function throwServerError() {
  const session = await requireSession();
  if (session.user.role !== "admin" && session.user.role !== "superadmin") {
    throw new Error("Forbidden");
  }
  throw new Error("SENTRY_TEST_SERVER_ACTION — intentional, verifying Sentry server-action capture");
}
