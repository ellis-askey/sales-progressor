import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { confirmUnsubscribeAction } from "./actions";
import "../claim/styles/claim-flow.css";

// no-referrer: the confirm step carries the token in the URL; don't let it leak
// via the Referer header.
export const metadata = { referrer: "no-referrer" } as const;

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
    <div className="claim-page">
      <ClaimBackground />
      <header className="claim-header">
        <a
          href="https://www.thesalesprogressor.co.uk"
          target="_blank"
          rel="noopener"
          className="claim-wordmark"
        >
          The Sales Progressor
        </a>
      </header>
      <div className="claim-error-wrap">
        <div className="claim-error-inner">
          {isConfirm ? (
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">Unsubscribe?</h1>
              <p className="claim-error-p">
                {isContact
                  ? "Confirm and we'll stop emailing you update reminders about your sale. We'll still contact you directly when we need something from you."
                  : "Confirm and we'll stop sending you emails from this address."}
              </p>
              <form action={confirmUnsubscribeAction} style={{ marginTop: 20 }}>
                <input type="hidden" name="t" value={t} />
                <button type="submit" className="claim-btn">Yes, unsubscribe</button>
              </form>
            </>
          ) : isOk && isContact ? (
            // Buyer/seller contact variant. Copy is intentionally GENERIC on
            // the address ("your sale", not "your sale at 12 Acacia Avenue")
            // — the page does not look up the contact by ID to avoid an
            // unauthenticated ID-keyed read. The recipient knows which sale;
            // they were just emailed about it.
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">You&apos;re unsubscribed</h1>
              <p className="claim-error-p">
                We won&apos;t email you about update reminders for your sale anymore. We&apos;ll still be in touch directly when we need something from you.
              </p>
              <p className="claim-error-support">
                Changed your mind? Get in touch and we can re-enable reminders for you.
              </p>
            </>
          ) : isOk ? (
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">You&apos;re unsubscribed</h1>
              <p className="claim-error-p">
                We won&apos;t send you any more emails from this address.
              </p>
              <p className="claim-error-support">
                Changed your mind?{" "}
                <a href="mailto:support@thesalesprogressor.co.uk">
                  support@thesalesprogressor.co.uk
                </a>
              </p>
            </>
          ) : (
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">Link not recognised</h1>
              <p className="claim-error-p">
                This unsubscribe link isn&apos;t valid. If you&apos;re still receiving emails,
                contact us directly.
              </p>
              <p className="claim-error-support">
                <a href="mailto:support@thesalesprogressor.co.uk">
                  support@thesalesprogressor.co.uk
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
