"use client";

// /dev/client-preview now renders the SHARED, production client-preview module
// (components/client-preview). Kept as a thin re-export so the dev page and the
// real app share exactly one implementation + one stylesheet.

export { UpdatePreviewCard, CheckpointPreviewCard, ClientPreviewStack as PreviewStack } from "@/components/client-preview/ClientPreview";
export type { ClientPreviewItem as ToastSpec } from "@/components/client-preview/ClientPreview";
