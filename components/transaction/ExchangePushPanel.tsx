import { requireSession } from "@/lib/session";
import { getAccessScope } from "@/lib/security/access-scope";
import { getExchangePushForTransaction } from "@/lib/services/exchange-push";
import { ExchangeChecklist } from "@/components/chain/ExchangeChecklist";

// Option 1: when a sale is ready on both sides but sits in a chain, this panel
// leads the Overview's chain area — the "chase the chain to exchange" checklist.
// Returns nothing when the sale isn't in push mode, so it only ever shows on a
// sale that's genuinely waiting on its chain. Critique 2026-10-02.
export async function ExchangePushPanel({ transactionId }: { transactionId: string }) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const push = await getExchangePushForTransaction(transactionId, scope).catch(() => null);
  if (!push) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <ExchangeChecklist push={push} />
    </div>
  );
}
