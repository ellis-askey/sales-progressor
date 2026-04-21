// components/ui/StatusBadge.tsx

import { STATUS_LABELS, STATUS_COLORS } from "@/lib/utils";
import type { TransactionStatus } from "@prisma/client";

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
