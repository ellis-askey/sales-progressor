import type { Metadata } from "next";
import Hub from "./hub-view";

export const metadata: Metadata = {
  title: "Hub · Sales Progressor",
  description: "Your pipeline, attention items, and exchange forecast at a glance.",
};

export default function HubPage() {
  return <Hub />;
}
