"use client";

import { ToastProvider } from "@/components/ui/ToastContext";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <FeedbackButton />
    </ToastProvider>
  );
}
