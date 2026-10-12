"use client";

// Share tab: publish state, the public link (copy / QR / embed), access rules
// (close date, submission limit), and notification settings (team alerts,
// respondent confirmation, webhook).

import { useState } from "react";
import type { FormDefinition, FormStatus } from "@/lib/forms/types";
import { BwButton, BwField, BwSwitch, useBwToast } from "../ui";

export function ShareTab({
  formId,
  publicId,
  status,
  def,
  update,
  publishBusy,
  onPublishAction,
  dirtySincePublish,
}: {
  formId: string;
  publicId: string;
  status: FormStatus;
  def: FormDefinition;
  update: (fn: (d: FormDefinition) => FormDefinition) => void;
  publishBusy: boolean;
  onPublishAction: (action: "publish" | "unpublish" | "close" | "reopen") => void;
  dirtySincePublish: boolean;
}) {
  const { toast } = useBwToast();
  const [notifyDraft, setNotifyDraft] = useState("");
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${publicId}`;
  const embedCode = `<iframe src="${publicUrl}" style="width:100%;height:600px;border:none;border-radius:12px;" title="${def.welcome.title.replace(/"/g, "&quot;")}" allow="camera"></iframe>`;

  const settings = def.settings;
  const setSettings = (patch: Partial<FormDefinition["settings"]>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  function copy(text: string, what: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast(`${what} copied.`),
      () => toast("Couldn't copy. Select it manually.", "error")
    );
  }

  function addNotifyEmail() {
    const email = notifyDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast("That doesn't look like an email address.", "error");
      return;
    }
    if (settings.notifyEmails.includes(email)) {
      setNotifyDraft("");
      return;
    }
    setSettings({ notifyEmails: [...settings.notifyEmails, email] });
    setNotifyDraft("");
  }

  const isLive = status === "published";
  const isClosed = status === "closed";

  return (
    <div className="bw-scroll" style={{ flex: 1, overflowY: "auto", padding: "26px 20px 80px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ── Publish state ── */}
        <section className="bw-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 className="bw-display" style={{ fontSize: 18, margin: "0 0 4px" }}>
                {isLive ? "Your form is live" : isClosed ? "Closed to new responses" : "Not published yet"}
              </h2>
              <p className="bw-hint" style={{ margin: 0 }}>
                {isLive
                  ? dirtySincePublish
                    ? "You've edited since publishing. Publish again to put the changes live."
                    : "Anyone with the link can respond."
                  : isClosed
                    ? "The link shows a closed message. Reopen any time."
                    : "Publish to get a shareable link."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(!isLive || dirtySincePublish) && !isClosed && (
                <BwButton variant="primary" loading={publishBusy} onClick={() => onPublishAction("publish")}>
                  {isLive ? "Publish changes" : "Publish"}
                </BwButton>
              )}
              {isLive && (
                <>
                  <BwButton loading={publishBusy} onClick={() => onPublishAction("close")}>Close form</BwButton>
                  <BwButton variant="ghost" loading={publishBusy} onClick={() => onPublishAction("unpublish")}>Unpublish</BwButton>
                </>
              )}
              {isClosed && (
                <BwButton variant="primary" loading={publishBusy} onClick={() => onPublishAction("reopen")}>Reopen</BwButton>
              )}
            </div>
          </div>
        </section>

        {/* ── Link / QR / embed ── */}
        {(isLive || isClosed) && (
          <section className="bw-card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>Share</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <input className="bw-input" readOnly value={publicUrl} style={{ flex: "1 1 260px", fontFamily: "monospace", fontSize: 13 }} onFocus={(e) => e.target.select()} />
              <BwButton variant="primary" onClick={() => copy(publicUrl, "Link")}>Copy link</BwButton>
              <BwButton onClick={() => window.open(publicUrl, "_blank")}>Open</BwButton>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              <div>
                <p className="bw-label">QR code</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/forms/${formId}/qr`}
                  alt="QR code linking to this form"
                  width={132}
                  height={132}
                  style={{ borderRadius: 10, border: "1px solid var(--bw-line)", display: "block", marginBottom: 8 }}
                />
                <a className="bw-btn bw-btn-secondary bw-btn-sm" href={`/api/forms/${formId}/qr`} download="form-qr.png">
                  Download PNG
                </a>
              </div>
              <div>
                <p className="bw-label">Embed on a website</p>
                <textarea
                  className="bw-textarea"
                  readOnly
                  rows={4}
                  value={embedCode}
                  style={{ fontFamily: "monospace", fontSize: 11.5 }}
                  onFocus={(e) => e.target.select()}
                />
                <BwButton size="sm" style={{ marginTop: 8 }} onClick={() => copy(embedCode, "Embed code")}>
                  Copy embed code
                </BwButton>
              </div>
            </div>
          </section>
        )}

        {/* ── Access rules ── */}
        <section className="bw-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>Access</h3>
          <p className="bw-hint" style={{ margin: "0 0 16px" }}>Optional limits. Leave blank for an always-open form.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <BwField label="Stop after this many responses">
              <input
                className="bw-input"
                type="number"
                min={1}
                placeholder="No limit"
                value={settings.submissionLimit ?? ""}
                onChange={(e) => setSettings({ submissionLimit: e.target.value ? Number(e.target.value) : null })}
              />
            </BwField>
            <BwField label="Closing date">
              <input
                className="bw-input"
                type="datetime-local"
                value={settings.closeAt ? settings.closeAt.slice(0, 16) : ""}
                onChange={(e) => setSettings({ closeAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </BwField>
          </div>
          <BwField label="Message when closed" hint="Shown in place of the form once it's closed or full.">
            <input
              className="bw-input"
              placeholder="This form is no longer accepting responses."
              value={settings.closedMessage ?? ""}
              onChange={(e) => setSettings({ closedMessage: e.target.value || undefined })}
            />
          </BwField>
        </section>

        {/* ── Notifications ── */}
        <section className="bw-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>Notifications</h3>
          <p className="bw-hint" style={{ margin: "0 0 16px" }}>Who hears about new responses, and what the respondent receives.</p>

          <p className="bw-label">Email the team on every response</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {settings.notifyEmails.map((email) => (
              <span key={email} className="bw-chip bw-chip-green" style={{ height: 26, fontSize: 12, paddingRight: 5 }}>
                {email}
                <button
                  aria-label={`Stop notifying ${email}`}
                  onClick={() => setSettings({ notifyEmails: settings.notifyEmails.filter((e) => e !== email) })}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontSize: 12, padding: "0 2px" }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              className="bw-input bw-input-sm"
              type="email"
              placeholder="name@boardwalk.co.uk"
              value={notifyDraft}
              onChange={(e) => setNotifyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNotifyEmail())}
              style={{ maxWidth: 280 }}
            />
            <BwButton size="sm" onClick={addNotifyEmail}>Add</BwButton>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--bw-line)" }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Send the respondent a confirmation email</p>
              <p className="bw-hint" style={{ margin: "2px 0 0" }}>Goes to the first email address they give in the form.</p>
            </div>
            <BwSwitch
              on={settings.respondentConfirmation.enabled}
              onToggle={(v) => setSettings({ respondentConfirmation: { ...settings.respondentConfirmation, enabled: v } })}
              label="Respondent confirmation"
            />
          </div>
          {settings.respondentConfirmation.enabled && (
            <div style={{ paddingTop: 8 }}>
              <BwField label="Subject">
                <input
                  className="bw-input bw-input-sm"
                  placeholder="Thanks, we've received your answers"
                  value={settings.respondentConfirmation.subject ?? ""}
                  onChange={(e) => setSettings({ respondentConfirmation: { ...settings.respondentConfirmation, subject: e.target.value || undefined } })}
                />
              </BwField>
              <BwField label="Message">
                <textarea
                  className="bw-textarea"
                  rows={3}
                  placeholder="Thanks for getting in touch. We'll come back to you within one working day."
                  value={settings.respondentConfirmation.message ?? ""}
                  onChange={(e) => setSettings({ respondentConfirmation: { ...settings.respondentConfirmation, message: e.target.value || undefined } })}
                />
              </BwField>
            </div>
          )}

          <div style={{ paddingTop: 12, borderTop: "1px solid var(--bw-line)", marginTop: 8 }}>
            <BwField label="Webhook URL (optional)" hint="We'll POST each submission as JSON, for Zapier, Make, or your own systems.">
              <input
                className="bw-input bw-input-sm"
                placeholder="https://…"
                value={settings.webhookUrl ?? ""}
                onChange={(e) => setSettings({ webhookUrl: e.target.value || null })}
              />
            </BwField>
          </div>
        </section>

        {/* ── Hidden fields ── */}
        <section className="bw-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>Hidden fields</h3>
          <p className="bw-hint" style={{ margin: "0 0 12px" }}>
            Capture tracking values from the link into each response. For example, with <code style={{ fontSize: 11 }}>?source=rightmove</code> on the URL, add a hidden field called <code style={{ fontSize: 11 }}>source</code>.
          </p>
          <HiddenFieldsEditor
            fields={settings.hiddenFields}
            onChange={(hiddenFields) => setSettings({ hiddenFields })}
          />
        </section>
      </div>
    </div>
  );
}

function HiddenFieldsEditor({ fields, onChange }: { fields: string[]; onChange: (fields: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    const key = draft.trim();
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(key)) return;
    if (!fields.includes(key)) onChange([...fields, key]);
    setDraft("");
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: fields.length ? 8 : 0 }}>
        {fields.map((f) => (
          <span key={f} className="bw-chip bw-chip-grey" style={{ height: 26, fontSize: 12, paddingRight: 5, fontFamily: "monospace" }}>
            {f}
            <button aria-label={`Remove ${f}`} onClick={() => onChange(fields.filter((x) => x !== f))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontSize: 12, padding: "0 2px" }}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="bw-input bw-input-sm"
          placeholder="field_name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          style={{ maxWidth: 200, fontFamily: "monospace", fontSize: 12.5 }}
        />
        <BwButton size="sm" onClick={add}>Add</BwButton>
      </div>
    </div>
  );
}
