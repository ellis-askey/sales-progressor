import { redirect } from "next/navigation";
import { getFormsSession } from "@/lib/forms/auth";

export const dynamic = "force-dynamic";

export default async function BoardwalkRoot() {
  const session = await getFormsSession();
  redirect(session ? "/boardwalk/typeform" : "/boardwalk/login");
}
