import { listLiveTransactionDocuments, type LiveTransactionDocumentRow } from "@/lib/services/transaction-documents";
import { docLabel } from "@/lib/portal-documents";

function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📎";
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Props = { transactionId: string };

// Presentational rows, reused by the archived-round drawer (DocumentsSection)
// and the live file's Documents tab (DocumentsPanel). Shows the document type
// as the headline when categorised, with the raw filename beneath.
export function DocumentsList({ docs }: { docs: LiveTransactionDocumentRow[] }) {
  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.4)" }}
        >
          <span className="text-xl flex-shrink-0">{fileIcon(doc.mimeType)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900/80 truncate">
              {doc.docType ? docLabel(doc.docType) : doc.filename}
            </p>
            <p className="text-xs text-slate-900/40 mt-0.5 truncate">
              {doc.docType ? `${doc.filename} · ` : ""}{fmtSize(doc.fileSize)} · {fmtDate(doc.createdAt)}
              {doc.contact && (
                <span className="ml-1">· Uploaded by {doc.contact.name} ({doc.contact.roleType})</span>
              )}
              {doc.source === "admin" && <span className="ml-1">· Team upload</span>}
            </p>
          </div>
          {doc.signedUrl ? (
            <a
              href={doc.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs font-semibold agent-link-primary transition-colors"
            >
              Download
            </a>
          ) : (
            <span className="flex-shrink-0 text-xs text-slate-900/30">Unavailable</span>
          )}
        </div>
      ))}
    </div>
  );
}

export async function DocumentsSection({ transactionId }: Props) {
  // Phase-2 PR 2 (TransactionDocument scoping): file-level docs (MoS,
  // admin, vendor/solicitor/broker portal uploads — all NULL buyerRoundId
  // by design) plus the active round's purchaser uploads. A fall-through
  // buyer's uploads (e.g. Marcus's AML pack on a relisted file) live only
  // in the archived drawer now, not here.
  const docsWithUrls = await listLiveTransactionDocuments(transactionId);

  if (docsWithUrls.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <p className="glass-section-label text-slate-900/40 mb-4">
        Documents ({docsWithUrls.length})
      </p>
      <DocumentsList docs={docsWithUrls} />
    </div>
  );
}
