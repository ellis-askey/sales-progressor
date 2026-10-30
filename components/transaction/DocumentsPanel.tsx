// Live-file Documents tab (Batch 2 follow-up, 2026-08-17). Lists the file's
// documents (categorised where a docType is set) and lets the agent add one
// with a Category -> Specific type picker, so the client sees proper labels.

import { listLiveTransactionDocuments } from "@/lib/services/transaction-documents";
import { DocumentsList } from "./DocumentsSection";
import { AgentDocumentUpload } from "./AgentDocumentUpload";
import { GlassTagDiv } from "@/components/glass/GlassTagDiv";

export async function DocumentsPanel({ transactionId }: { transactionId: string }) {
  const docs = await listLiveTransactionDocuments(transactionId);

  return (
    <GlassTagDiv glassId="documents-panel" label="Documents · panel" className="p-5" surfaceClassName="glass-card">
      <div className="flex items-center justify-between mb-4" data-bloom>
        <p className="glass-section-label text-[var(--agent-text-muted)]">Documents ({docs.length})</p>
        <AgentDocumentUpload transactionId={transactionId} />
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-[var(--agent-text-muted)] py-6 text-center">
          No documents on this file yet. Use “Add document” to upload one.
        </p>
      ) : (
        <DocumentsList docs={docs} />
      )}
    </GlassTagDiv>
  );
}
