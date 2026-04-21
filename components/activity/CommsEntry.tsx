"use client";
// components/activity/CommsEntry.tsx
// 3-step communication entry: type → method → contacts → content
// "Start over" resets to step 1.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; name: string; roleType: string };

type Props = {
  transactionId: string;
  contacts: Contact[];
};

type CommType = "internal_note" | "outbound" | "inbound";
type CommMethod = "email" | "phone" | "sms" | "voicemail" | "whatsapp" | "post";

const METHODS: { value: CommMethod; label: string; color: string; icon: string }[] = [
  { value: "email",     label: "Email",     color: "bg-purple-100 text-purple-700 border-purple-200", icon: "✉" },
  { value: "phone",     label: "Phone",     color: "bg-blue-100 text-blue-700 border-blue-200",       icon: "📞" },
  { value: "sms",       label: "SMS",       color: "bg-green-100 text-green-700 border-green-200",    icon: "💬" },
  { value: "voicemail", label: "Voicemail", color: "bg-teal-100 text-teal-700 border-teal-200",       icon: "📱" },
  { value: "whatsapp",  label: "WhatsApp",  color: "bg-green-100 text-green-700 border-green-200",    icon: "📲" },
  { value: "post",      label: "Post",      color: "bg-gray-100 text-gray-700 border-gray-200",       icon: "📮" },
];

export function CommsEntry({ transactionId, contacts }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [type, setType] = useState<CommType | null>(null);
  const [method, setMethod] = useState<CommMethod | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function reset() {
    setStep(1);
    setType(null);
    setMethod(null);
    setSelectedContacts([]);
    setContent("");
    setVisibleToClient(false);
    setExpanded(false);
  }

  function selectType(t: CommType) {
    setType(t);
    if (t === "internal_note") {
      setStep(4); // Skip method + contacts
    } else {
      setStep(2);
    }
  }

  function selectMethod(m: CommMethod) {
    setMethod(m);
    setStep(3);
  }

  function toggleContact(id: string) {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          type,
          method,
          contactIds: selectedContacts,
          content,
          visibleToClient,
        }),
      });
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Collapsed state — just a prompt
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-[#d1dae6] text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-white transition-all"
      >
        + Add a note or log a communication…
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

      {/* Step indicator + start over */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f4f8] bg-gray-50/50">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => {
            const isActive = step === s;
            const isDone = step > s && !(type === "internal_note" && s > 1 && s < 4);
            const isSkipped = type === "internal_note" && (s === 2 || s === 3);
            if (isSkipped) return null;
            return (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium ${
                  isDone ? "bg-green-500 text-white" :
                  isActive ? "bg-blue-500 text-white" :
                  "bg-gray-200 text-gray-400"
                }`}>
                  {isDone ? "✓" : s}
                </div>
                {s < 4 && !isSkipped && <div className="w-4 h-px bg-gray-200" />}
              </div>
            );
          })}
        </div>
        <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Start over
        </button>
      </div>

      <div className="px-5 py-4">
        {/* Step 1: Type */}
        {step === 1 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3">What type of entry is this?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectType("internal_note")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e4e9f0] text-sm font-medium text-gray-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all"
              >
                <span>📝</span> Internal note
              </button>
              <button
                onClick={() => selectType("outbound")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e4e9f0] text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all"
              >
                <span>→</span> Outbound
              </button>
              <button
                onClick={() => selectType("inbound")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#e4e9f0] text-sm font-medium text-gray-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all"
              >
                <span>←</span> Inbound
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Method */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TypeBadge type={type!} />
              <span className="text-xs text-gray-400">→</span>
              <p className="text-xs font-medium text-gray-500">How was this communication made?</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => selectMethod(m.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all hover:opacity-80 ${m.color}`}
                >
                  <span>{m.icon}</span> {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Contacts */}
        {step === 3 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TypeBadge type={type!} />
              <MethodBadge method={method!} />
              <span className="text-xs text-gray-400">→</span>
              <p className="text-xs font-medium text-gray-500">Who was involved?</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {contacts.map((c) => {
                const selected = selectedContacts.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleContact(c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      selected
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                        : "border-[#e4e9f0] text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      selected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              {selectedContacts.length === 0 ? "Skip" : "Continue"}
            </button>
          </div>
        )}

        {/* Step 4: Content */}
        {step === 4 && (
          <div>
            {type !== "internal_note" && (
              <div className="flex items-center gap-2 mb-3">
                <TypeBadge type={type!} />
                {method && <MethodBadge method={method} />}
                {selectedContacts.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {contacts.filter((c) => selectedContacts.includes(c.id)).map((c) => c.name.split(" ")[0]).join(", ")}
                  </span>
                )}
              </div>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === "internal_note" ? "Add an internal note…" : "What was discussed or communicated?"}
              rows={4}
              className="w-full px-3 py-2.5 text-sm border border-[#e4e9f0] rounded-lg bg-white focus:outline-none focus:border-blue-400 resize-none placeholder:text-gray-300"
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={submit}
                  disabled={!content.trim() || loading}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              </div>
              {type !== "internal_note" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setVisibleToClient((v) => !v)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                      visibleToClient ? "bg-[#3a7bd5]" : "bg-gray-200"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ml-0.5 ${
                      visibleToClient ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </div>
                  <span className="text-xs text-gray-500">Share with client</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small badge components ────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    internal_note: "bg-amber-100 text-amber-700",
    outbound: "bg-blue-100 text-blue-700",
    inbound: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    internal_note: "📝 Internal",
    outbound: "→ Outbound",
    inbound: "← Inbound",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const m = METHODS.find((x) => x.value === method);
  if (!m) return null;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}
