import { getUninvitedNeighbourCount } from "@/lib/services/chains";

// A quiet nudge on the file's chain card: when neighbours have been added with an
// email but never invited, that's lost pipeline. Rendered as an async server
// component so it does its own count query and shows nothing when there's nothing
// to do. The action is the existing "Open chain" button right beside it.
// See docs/active/chain-invite-conversion — Phase 4.
export async function UninvitedNeighboursNote({ transactionId }: { transactionId: string }) {
  const count = await getUninvitedNeighbourCount(transactionId);
  if (count === 0) return null;

  return (
    <p style={{ fontSize: 11, color: "var(--agent-warning)", fontWeight: 500, margin: "2px 0 0" }}>
      {count === 1 ? "1 neighbour is added but not invited yet" : `${count} neighbours are added but not invited yet`}
    </p>
  );
}
