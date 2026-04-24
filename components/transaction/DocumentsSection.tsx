import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";

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

export async function DocumentsSection({ transactionId }: Props) {
  const docs = await prisma.transactionDocument.findMany({
    where: { transactionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, filename: true, storagePath: true, fileSize: true,
      mimeType: true, source: true, createdAt: true,
      contact: { select: { name: true, roleType: true } },
    },
  });

  if (docs.length === 0) return null;

  const docsWithUrls = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      signedUrl: await getSignedUrl(d.storagePath).catch(() => null),
    }))
  );

  return (
    <div className="glass-card p-5">
      <p className="glass-section-label text-slate-900/40 mb-4">
        Documents ({docs.length})
      </p>
      <div className="space-y-2">
        {docsWithUrls.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.4)" }}
          >
            <span className="text-xl flex-shrink-0">{fileIcon(doc.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900/80 truncate">{doc.filename}</p>
              <p className="text-xs text-slate-900/40 mt-0.5">
                {fmtSize(doc.fileSize)} · {fmtDate(doc.createdAt)}
                {doc.contact && (
                  <span className="ml-1">
                    · Uploaded by {doc.contact.name} ({doc.contact.roleType})
                  </span>
                )}
                {doc.source === "admin" && <span className="ml-1">· Admin upload</span>}
              </p>
            </div>
            {doc.signedUrl ? (
              <a
                href={doc.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Download
              </a>
            ) : (
              <span className="flex-shrink-0 text-xs text-slate-900/30">Unavailable</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
