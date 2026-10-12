import { ResetPasswordCard } from "@/components/boardwalk/ResetPasswordCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reset password" };

export default async function BoardwalkResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordCard token={token ?? ""} />;
}
