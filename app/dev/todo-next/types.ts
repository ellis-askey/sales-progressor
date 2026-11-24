import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";
import type { ReviewItem } from "@/lib/services/reviews";

export type Task = ManualTaskWithRelations;
export type { ReviewItem };

// The serialisable payload the server page hands the client workspace. Mirrors
// exactly what /agent/to-do fetches, so the founder sees identical real data.
export type TodoNextData = {
  tasks: Task[];
  reviews: { items: ReviewItem[]; done: ReviewItem[] };
  photoByTx: Record<string, string | null>;
  attachableFiles: { id: string; propertyAddress: string }[];
  role: string;
  isProgressor: boolean;
  isInternal: boolean;
  canUseProgressor: boolean;
  hasOutsourced: boolean;
  progressorName: string | null;
  reviewsDueCount: number;
  subtitle: string;
  viewerName: string;
  viewerEmail: string;
};

export type DueTone = "muted" | "warn" | "danger" | "ok";
export type BucketKey = "mine" | "internal" | "prog" | "reviews";
