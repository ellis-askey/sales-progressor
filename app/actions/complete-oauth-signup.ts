"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createDirectorWithAgency } from "@/lib/auth/create-director-with-agency";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function completeOAuthSignup(formData: FormData): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not signed in" };
  }

  if (!session.user.needsSignupCompletion) {
    return { ok: false, error: "Signup already complete" };
  }

  const rawName = (formData.get("name") as string | null)?.trim() ?? "";
  const rawRole = formData.get("role") as string | null;
  const rawAgencyName = (formData.get("agencyName") as string | null)?.trim() ?? "";

  if (!rawName) return { ok: false, error: "Name is required" };
  if (rawRole !== "director" && rawRole !== "negotiator") {
    return { ok: false, error: "Please select a role" };
  }

  // Negotiators may omit agency name — default to their own name
  const agencyName = rawAgencyName || toTitleCase(rawName);

  try {
    await createDirectorWithAgency({
      userId: session.user.id,
      name: toTitleCase(rawName),
      email: session.user.email,
      role: rawRole,
      agencyName: toTitleCase(agencyName),
    });

    console.log(`[AUDIT] oauth_signup_completed userId=${session.user.id} role=${rawRole}`);
    return { ok: true };
  } catch (e) {
    console.error("completeOAuthSignup error:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
