// /agent/settings → the owner's business identity tab (the distinctive landing).
import { redirect } from "next/navigation";

export default function BusinessSettingsIndex() {
  redirect("/agent/settings/business");
}
