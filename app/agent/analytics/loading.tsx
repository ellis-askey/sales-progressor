// Analytics route fallback — quiet title-only (2026-10-18 load-in bloom). The
// branded loader was retired in the universal sweep: the title paints instantly
// and the content blooms in (BrandedReveal → .agent-bloom) when the data lands.
import { PageHeader } from "@/components/layout/PageHeader";

export default function Loading() {
  return <PageHeader title="Analytics" subtitle="Performance and revenue across your pipeline." />;
}
