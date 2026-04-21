"use client";

import { ToastProvider } from "@/components/ui/ToastContext";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
