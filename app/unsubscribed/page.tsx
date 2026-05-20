import "../claim/styles/claim-flow.css";

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const isOk = status === "ok";

  return (
    <div className="claim-page">
      <header className="claim-header">
        <span className="claim-wordmark">The Sales Progressor</span>
      </header>
      <div className="claim-error-wrap">
        <div className="claim-error-inner">
          {isOk ? (
            <>
              <p className="claim-error-eyebrow">The Sales Progressor</p>
              <h1 className="claim-error-h1">You&apos;re unsubscribed</h1>
              <p className="claim-error-p">
                You won&apos;t receive any more emails from Sales Progressor.
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
