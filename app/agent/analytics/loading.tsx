// Analytics route fallback (branded-loader trial, replacing the skeleton).
// Navigation commits immediately, the header appears in place, and the branded
// loader (mark + ambient glow + progression dots) fills the wait. When the data
// lands, BrandedReveal in page.tsx dissolves this exact loader while the content
// blurs up. Trialled on Analytics only before any universal rollout.
import { PageHeader } from "@/components/layout/PageHeader";
import { BrandedLoader } from "@/components/agent/BrandedLoader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Analytics" subtitle="Performance and revenue across your pipeline." />
      <div className="brand-loader-hold">
        <BrandedLoader />
      </div>
    </>
  );
}
