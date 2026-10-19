// GET exit for founder "view as". A GET (not a mutation) so the edge mutation
// block never traps the operator. Clears the view-as cookie and drops back to
// the Command Centre. Safe for anyone to hit — it only ever removes the cookie.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VIEW_AS_COOKIE } from "@/lib/security/view-as";

export async function GET(req: Request) {
  (await cookies()).delete(VIEW_AS_COOKIE);
  return NextResponse.redirect(new URL("/command/agencies", req.url));
}
