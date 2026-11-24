// /dev/icon-lab — isolated Icon Design Laboratory. Dev-only (prod-blocked, same
// convention as the other /dev prototypes). Renders only static audited data and
// fabricated sample UI; it imports nothing from the production app and changes
// nothing in it.

import { notFound } from "next/navigation";
import IconLab from "./IconLab";

export const metadata = { title: "Icon Lab · Dev" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <IconLab />;
}
