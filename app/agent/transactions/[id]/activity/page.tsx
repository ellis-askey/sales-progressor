// The Activity tab was merged into the Steps/Activity tab (the activity feed is
// now the ~40% column beside Steps — milestones/page.tsx). This route stays only
// to redirect any lingering links/bookmarks (e.g. the Hub) to the merged tab.
import { redirect } from "next/navigation";

export default async function ActivityTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/agent/transactions/${id}/milestones`);
}
