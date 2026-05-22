import { ClaimBackground } from "@/components/claim/ClaimBackground";
import "../claim/styles/claim-flow.css";

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const { status, type } = await searchParams;
  const isOk = status === "ok";
  const isContact = type === "contact";

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
          {isOk && isContact ? (
            // Buyer/seller contact variant. Copy is intentionally GENERIC on
            // the address ("your sale", not "your sale at 12 Acacia Avenue")
            // — the page does not look up the contact by ID to avoid an
            // unauthenticated ID-keyed read. The recipient knows which sale;
            // they were just emailed about it.
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">You&apos;re unsubscribed</h1>
              <p className="claim-error-p">
                We won&apos;t email you about update reminders for your sale anymore. Your agent will still be in touch directly when they need something from you.
              </p>
              <p className="claim-error-support">
                Changed your mind? Tell your agent and they can re-enable reminders for you.
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
