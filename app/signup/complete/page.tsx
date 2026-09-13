import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CompleteSignupForm } from "./CompleteSignupForm";
import { resolveSignupDestination } from "@/lib/auth/signup-destination";
import { createJoinRequest, getLatestJoinRequestForUser } from "@/lib/services/agency-join-requests";

export default async function CompleteSignupPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.needsSignupCompletion) {
    // Already complete — send to root which handles role-based routing
    redirect("/");
  }

  // Fix 8: route OAuth users into the request-to-join flow when appropriate.
  // OAuth has already proven mailbox ownership, so this is disclosure-safe.
  const latest = await getLatestJoinRequestForUser(session.user.id);
  if (latest?.status === "pending") {
    redirect("/signup/pending");
  }
  if (!latest) {
    // No prior request — if the email belongs to an agency with a verified
    // domain, create a request and wait for a director. A decided request
    // (rejected/expired) falls through so they can create their own agency.
    const destination = await resolveSignupDestination(session.user.email);
    if (destination.kind === "join_request") {
      await createJoinRequest({
        requesterUserId: session.user.id,
        requesterEmail: session.user.email,
        requesterName: session.user.name ?? session.user.email,
        agencyId: destination.agencyId,
        requestedRole: "negotiator", // director chooses the final role at approval
      });
      redirect("/signup/pending");
    }
  }

  return (
    <CompleteSignupForm
      defaultName={session.user.name ?? ""}
      email={session.user.email}
    />
  );
}
