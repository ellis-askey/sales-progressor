// app/not-found.tsx — app-wide 404.

import { NotFoundView } from "@/components/ui/NotFoundView";

export default function NotFound() {
  return (
    <NotFoundView
      title="Page not found"
      message="The page you're after doesn't exist, or the link may have expired. Let's get you back on track."
      cta={{ label: "Back to dashboard", href: "/dashboard" }}
    />
  );
}
