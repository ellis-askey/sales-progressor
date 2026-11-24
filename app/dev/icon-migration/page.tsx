// /dev/icon-migration — Solar Bold Duotone app-wide migration PREVIEW. Dev-only
// (prod-blocked, same convention as other /dev prototypes). Renders only static
// scanned data + a fabricated dashboard; imports nothing from the production app
// and changes no live icon. The migration is prepared (migration-config.ts), not
// activated.

import { notFound } from "next/navigation";
import IconMigration from "./IconMigration";

export const metadata = { title: "Icon Migration · Solar · Dev" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <IconMigration />;
}
