import { LoadingCard } from "@/components/loading/LoadingCard";

export default function AgentTransactionLoading() {
  return (
    <div className="glass-page agent-page pt-4 px-4 md:px-8" style={{ minHeight: "100vh" }}>
      <LoadingCard label="Loading file" minHeight={280} />
    </div>
  );
}
