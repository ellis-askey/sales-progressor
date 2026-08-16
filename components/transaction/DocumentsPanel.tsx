// Live-file Documents tab (Batch 2 follow-up, 2026-08-17). Lists the file's
// documents (categorised where a docType is set) and lets the agent add one
// with a Category -> Specific type picker, so the client sees proper labels.

import { listLiveTransactionDocuments } from "@/lib/services/transaction-documents";
import { DocumentsList } from "./DocumentsSection";
import { AgentDocumentUpload } from "./AgentDocumentUpload";

export async function DocumentsPanel({ transactionId }: { transactionId: string }) {
  const docs = await listLiveTransactionDocuments(transactionId);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="glass-section-label text-slate-900/40">Documents ({docs.length})</p>
        <AgentDocumentUpload transactionId={transactionId} />
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-slate-900/40 py-6 text-center">
          No documents on this file yet. Use “Add document” to upload one.
        </p>
      ) : (
        <DocumentsList docs={docs} />
      )}
    </div>
  );
}
