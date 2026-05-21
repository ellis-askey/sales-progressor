"use client";

import { useState } from "react";

export default function SolicitorEnquiryEmailMockup() {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  function handleConfirm(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setConfirmed(true);
    setConfirmedAt(new Date().toLocaleString("en-GB", {
      weekday: "long", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit",
    }));
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f5f7",
      padding: "40px 16px",
      fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
    }}>
      <p style={{
        maxWidth: 560,
        margin: "0 auto 16px",
        fontSize: 12,
        color: "#8b91a3",
        textAlign: "center",
      }}>
        Demo — this is what a solicitor would see in their inbox.
      </p>

      <div style={{
        maxWidth: 560,
        margin: "0 auto",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
        color: "#1a1d29",
      }}>
        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%)",
          padding: "32px 32px 28px",
        }}>
          <p style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
          }}>
            Enquiry update
          </p>
          <h1 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.3,
          }}>
            {confirmed ? "Thanks — that's confirmed" : "Have you raised initial enquiries?"}
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px" }}>
          {!confirmed ? (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 15 }}>
                Hello Smith &amp; Co,
              </p>

              <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: "#4a5162" }}>
                Emily Chen at <strong>Hartwell &amp; Partners</strong> is tracking the sale of{" "}
                <strong>73 Jutland House, DA17 6FG</strong> and is checking in on early progress.
              </p>

              <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.7, color: "#4a5162" }}>
                To keep things moving on the buyer's side, we just need to confirm: have you
                raised initial enquiries with the seller's solicitor yet?
              </p>

              <div style={{
                margin: "0 0 24px",
                padding: "16px 20px",
                background: "#FFF8F6",
                borderLeft: "3px solid #FF6B4A",
                borderRadius: 8,
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#1a1d29" }}>
                  One tap — no login, no reply needed.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>
                  Just confirms it on the file.
                </p>
              </div>

              <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.7, color: "#4a5162" }}>
                Saves us chasing you over email or phone — and gives the buyer's agent live
                visibility so they stop chasing too.
              </p>

              <p style={{ margin: "0 0 16px" }}>
                <a
                  href="#"
                  onClick={handleConfirm}
                  style={{
                    display: "inline-block",
                    background: "#FF6B4A",
                    color: "#fff",
                    padding: "13px 28px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  Yes — enquiries raised
                </a>
              </p>

              <p style={{ margin: "0 0 24px", fontSize: 12, color: "#8b91a3" }}>
                Not yet? <a href="#" style={{ color: "#8b91a3", textDecoration: "underline" }}>
                  I'll update when done →
                </a>
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 15 }}>
                Hello Smith &amp; Co,
              </p>

              <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: "#4a5162" }}>
                Thanks — that's logged on the file. The buyer's agent has been notified. You
                don't need to do anything else.
              </p>

              <div style={{
                margin: "0 0 24px",
                padding: "16px 20px",
                background: "#F0FDF4",
                borderLeft: "3px solid #16A34A",
                borderRadius: 8,
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#15803D" }}>
                  Confirmed {confirmedAt}
                </p>
              </div>
            </>
          )}

          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8b91a3" }}>
            Need help? <a href="mailto:support@thesalesprogressor.co.uk" style={{ color: "#8b91a3" }}>
              support@thesalesprogressor.co.uk
            </a>
          </p>

          <p style={{ margin: "24px 0 0", fontSize: 11, color: "#c0c4d0", textAlign: "center" }}>
            Powered by{" "}
            <a href="https://www.thesalesprogressor.co.uk" style={{ color: "#c0c4d0", textDecoration: "none" }}>
              Sales Progressor
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
