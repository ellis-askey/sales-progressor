/**
 * One-off cleanup: delete all feedback screenshots captured before redaction was in place.
 * - Deletes files from Supabase Storage (feedback-screenshots bucket)
 * - Clears screenshotUrl + screenshotFilename from FeedbackSubmission records
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/cleanup-feedback-screenshots.ts
 */

// Load env vars from .env file
import { readFileSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && m[1] && m[2] && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
} catch {
  // .env not present — rely on environment
}

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const BUCKET = "feedback-screenshots";

  // Find all submissions that have a screenshot
  const submissions = await prisma.feedbackSubmission.findMany({
    where: { screenshotUrl: { not: null } },
    select: { id: true, screenshotUrl: true, screenshotFilename: true },
  });

  console.log(`Found ${submissions.length} submission(s) with screenshots.`);

  if (submissions.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const sub of submissions) {
    try {
      // Extract storage path from the signed URL
      // URL format: https://{project}.supabase.co/storage/v1/object/sign/{bucket}/{path}?token=...
      let filePath: string | null = null;
      if (sub.screenshotUrl) {
        try {
          const url = new URL(sub.screenshotUrl);
          const marker = `/object/sign/${BUCKET}/`;
          const idx = url.pathname.indexOf(marker);
          if (idx !== -1) {
            filePath = url.pathname.slice(idx + marker.length);
          }
        } catch {
          console.warn(`  [${sub.id}] Could not parse URL: ${sub.screenshotUrl}`);
        }
      }

      if (filePath) {
        const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
        if (error) {
          console.warn(`  [${sub.id}] Storage delete failed (file may already be gone): ${error.message}`);
        } else {
          console.log(`  [${sub.id}] Deleted file: ${filePath}`);
        }
      }

      // Clear the URL from DB regardless of whether the file delete succeeded
      await prisma.feedbackSubmission.update({
        where: { id: sub.id },
        data: { screenshotUrl: null, screenshotFilename: null },
      });
      deleted++;
    } catch (err) {
      console.error(`  [${sub.id}] Error:`, err);
      failed++;
    }
  }

  console.log(`\nDone. ${deleted} record(s) cleaned, ${failed} failure(s).`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
