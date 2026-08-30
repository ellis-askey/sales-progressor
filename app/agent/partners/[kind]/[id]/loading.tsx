import { LoadingCard } from "@/components/loading/LoadingCard";

export default function PartnerFirmDetailLoading() {
  return (
    <div className="px-4 md:px-8 py-4 md:py-6" style={{ maxWidth: 860, margin: "0 auto" }}>
      <LoadingCard label="Loading firm" minHeight={260} />
    </div>
  );
}
