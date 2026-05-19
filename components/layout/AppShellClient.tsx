"use client";

import { FeedbackButton } from "@/components/feedback/FeedbackButton";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
