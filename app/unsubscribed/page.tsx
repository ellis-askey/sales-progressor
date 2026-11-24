import { confirmUnsubscribeAction } from "./actions";
import { AuthNoticeShell } from "@/components/ui/AuthNoticeShell";
import { PageTitle } from "@/components/ui/PageTitle";

// no-referrer: the confirm step carries the token in the URL; don't let it leak
// via the Referer header.
export const metadata = { referrer: "no-referrer" } as const;

const CORAL = "#FF6B4A";

function SuccessTick() {
  return (
    <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,107,74,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={CORAL} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  );
}

const supportLink: React.CSSProperties = { color: CORAL, fontWeight: 500, textDecoration: "none" };
const supportP: React.CSSProperties = { margin: 0, fontSize: 13, color: "rgba(45,24,16,0.55)", lineHeight: 1.6 };

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; t?: string }>;
}) {
  const { status, type, t } = await searchParams;
  const isOk = status === "ok";
  const isContact = type === "contact";
  // Confirm step: arrived from the email link (token present, not yet applied).
  // The actual unsubscribe only fires when they press the button (a POST), so an
  // email scanner opening this page in the background changes nothing.
  const isConfirm = !status && !!t;

  return (
    <AuthNoticeShell>
      {isConfirm ? (
        <>
          <PageTitle
            title="Unsubscribe?"
            subtitle={isContact
              ? "Confirm and we'll stop emailing you update reminders about your sale. We'll still contact you directly when we need something from you."
              : "Confirm and we'll stop sending you emails from this address."}
            style={{ marginBottom: 20 }}
          />
          {/* Flat coral primary (arc Button resting look). Inline + scoped hover so
              this stays a server component. */}
          <style dangerouslySetInnerHTML={{ __html: `.unsub-btn:hover{background:#E85A35}` }} />
          <form action={confirmUnsubscribeAction}>
            <input type="hidden" name="t" value={t} />
            <button
              type="submit"
              className="unsub-btn"
              style={{ width: "100%", padding: "13px", borderRadius: 10, background: CORAL, color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", transition: "background 0.12s ease" }}
            >
              Yes, unsubscribe
            </button>
          </form>
        </>
      ) : isOk ? (
        // Buyer/seller contact variant keeps its address GENERIC ("your sale"):
        // the page never looks the contact up by ID, to avoid an unauthenticated
        // ID-keyed read. The recipient knows which sale; they were just emailed.
        <div style={{ textAlign: "center" }}>
          <SuccessTick />
          <PageTitle
            title="You're unsubscribed."
            subtitle={isContact
              ? "We won't email you about update reminders for your sale anymore. We'll still be in touch directly when we need something from you."
              : "We won't send you any more emails from this address."}
            style={{ marginBottom: 12 }}
          />
          <p style={supportP}>
            {isContact ? (
              "Changed your mind? Get in touch and we can re-enable reminders for you."
            ) : (
              <>
                Changed your mind?{" "}
                <a href="mailto:support@thesalesprogressor.co.uk" style={supportLink}>
                  support@thesalesprogressor.co.uk
                </a>
              </>
            )}
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <PageTitle
            title="Link not recognised."
            subtitle="This unsubscribe link isn't valid. If you're still receiving emails, contact us directly."
            style={{ marginBottom: 12 }}
          />
          <p style={supportP}>
            <a href="mailto:support@thesalesprogressor.co.uk" style={supportLink}>
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      )}
    </AuthNoticeShell>
  );
}
