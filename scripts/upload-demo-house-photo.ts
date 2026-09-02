// One-shot: upload the demo hero photo (Images/House.png) into the
// transaction-documents bucket at demo/house.png, which the demo showcase file
// (DEMO_PRESET.photoStoragePath) points at. The asset was uploaded to prod but
// not to every environment, so a demo on staging showed the empty "Add photo"
// hero. Idempotent (upsert). Uploads to whatever NEXT_PUBLIC_SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY point at.
//
// Registered in docs/SCRIPTS_REGISTRY.md. Delete once demo assets are seeded
// into every environment's storage as part of the demo build.
//
// Run:
//   npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/upload-demo-house-photo.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { uploadToStorage, storageObjectExists, getSignedUrl } from "@/lib/supabase-storage";

const STORAGE_PATH = "demo/house.png";
const SOURCE = resolve(process.cwd(), "Images", "House.png");

async function main() {
  const already = await storageObjectExists(STORAGE_PATH).catch(() => false);
  console.log(`demo/house.png already present: ${already}`);

  const buffer = readFileSync(SOURCE);
  console.log(`Uploading ${SOURCE} (${(buffer.length / 1024).toFixed(0)} KB) → ${STORAGE_PATH} ...`);
  await uploadToStorage(STORAGE_PATH, buffer, "image/png", { upsert: true });

  const signed = await getSignedUrl(STORAGE_PATH, 60).catch((e) => `signing failed: ${e}`);
  console.log("Uploaded. Signed URL check:", signed.slice(0, 80) + "...");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
