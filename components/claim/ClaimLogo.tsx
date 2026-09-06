// The Sales Progressor logo lockup for the claim flow header — matches the
// agent-email header (tsp-logo mark + "TSP" wordmark + "SALES PROGRESSOR").
export function ClaimLogo() {
  return (
    <a
      href="https://www.thesalesprogressor.co.uk"
      target="_blank"
      rel="noopener"
      className="claim-logo"
      aria-label="The Sales Progressor"
    >
      <img src="/claim/tsp-logo.png" alt="" className="claim-logo-mark" />
      <span className="claim-logo-text">
        <span className="claim-logo-tsp">TSP</span>
        <span className="claim-logo-sub">SALES PROGRESSOR</span>
      </span>
    </a>
  );
}
