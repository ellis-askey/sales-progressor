import "server-only";

// Minimal read-only GitHub client for Phase 3 auto-drafting. Reads the commits
// that newly landed in a production release (base..head). Uses a fine-grained,
// read-only token (GITHUB_TOKEN) restricted to this one repo. No writes, ever.
// Absent token → returns null so the automation no-ops gracefully.

const REPO = "ellis-askey/sales-progressor";

export type ReleaseCommit = {
  sha: string;
  subject: string; // first line of the commit message
  body: string; // the rest (trimmed)
  isMerge: boolean; // a merge commit (2+ parents) — always noise
};

// Commits in base..head (those in head but not base), oldest-first. Returns null
// when no token is configured. Throws on an API/network error so the caller can
// retry on the next run WITHOUT marking the release processed (cheap: no AI runs
// unless this succeeds).
export async function fetchCommitsBetween(base: string, head: string): Promise<ReleaseCommit[] | null> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) return null;

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=250`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "sales-progressor-platform-updates",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub compare ${base.slice(0, 8)}...${head.slice(0, 8)} failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    commits?: Array<{ sha: string; commit?: { message?: string }; parents?: unknown[] }>;
  };
  const commits = data.commits ?? [];
  return commits.map((c) => {
    const msg = c.commit?.message ?? "";
    const nl = msg.indexOf("\n");
    return {
      sha: c.sha,
      subject: (nl === -1 ? msg : msg.slice(0, nl)).trim(),
      body: (nl === -1 ? "" : msg.slice(nl + 1)).trim(),
      isMerge: Array.isArray(c.parents) && c.parents.length > 1,
    };
  });
}
