// Registry of authored Model B skeletons. Populated as authoring
// progresses. The runtime send path (lib/services/portal.ts) checks
// this registry for the current milestoneCode; if the skeleton exists
// AND the feature flag is enabled, the assembler is used. Otherwise
// the legacy lib/portal-copy.ts emailCopy fires unchanged.
//
// No-op contract: until EMAIL_SKELETON_MODE is set to "on" at runtime,
// the registry is never consulted by the live send path — every email
// behaves exactly as it did before this work began. Snapshot tooling
// reads the registry directly (no flag) so authoring can be reviewed.
//
// ⚠ ENQUIRIES REWORK (2026-08-14): the enquiries skeletons (PM14, VM10, and
// the now-retired PM15-19 / VM11-15) are STALE relative to the collapsed
// enquiries model — they still carry the old bilateral direction variants and
// hand-off nudges that point at deleted milestones. The LIVE enquiries emails
// were fixed in lib/portal-copy.ts instead. DO NOT enable EMAIL_SKELETON_MODE
// until the enquiries skeletons are reconciled with the new model, or those
// emails will misbehave. See docs/active/enquiries-stage-rework-SPEC.md (1.8).

import type { MilestoneSkeleton } from "@/lib/email-assembler";

import { VM1_SKELETON } from "./vm1";
import { PM1_SKELETON } from "./pm1";
import { VM2_SKELETON } from "./vm2";
import { PM2_SKELETON } from "./pm2";
import { VM3_SKELETON } from "./vm3";
import { VM4_SKELETON } from "./vm4";
import { PM3_SKELETON } from "./pm3";
import { PM4_SKELETON } from "./pm4";
import { VM5_SKELETON } from "./vm5";
import { VM6_SKELETON } from "./vm6";
import { PM5_SKELETON } from "./pm5";
import { PM6_SKELETON } from "./pm6";
import { PM11_SKELETON } from "./pm11";
import { VM7_SKELETON } from "./vm7";
import { PM7_SKELETON } from "./pm7";
import { VM8_SKELETON } from "./vm8";
import { VM9_SKELETON } from "./vm9";
import { PM12_SKELETON } from "./pm12";
import { PM8_SKELETON } from "./pm8";
import { PM13_SKELETON } from "./pm13";
import { PM9_SKELETON } from "./pm9";
import { PM10_SKELETON } from "./pm10";
import { PM14_SKELETON } from "./pm14";
import { VM10_SKELETON } from "./vm10";
import { VM11_SKELETON } from "./vm11";
import { VM12_SKELETON } from "./vm12";
import { PM15_SKELETON } from "./pm15";
import { PM16_SKELETON } from "./pm16";
import { PM17_SKELETON } from "./pm17";
import { VM13_SKELETON } from "./vm13";
import { VM14_SKELETON } from "./vm14";
import { VM15_SKELETON } from "./vm15";
import { PM18_SKELETON } from "./pm18";
import { PM19_SKELETON } from "./pm19";
import { PM20_SKELETON } from "./pm20";
import { PM21_SKELETON } from "./pm21";
import { VM16_SKELETON } from "./vm16";
import { VM17_SKELETON } from "./vm17";
import { PM22_SKELETON } from "./pm22";
import { PM23_SKELETON } from "./pm23";
import { PM24_SKELETON } from "./pm24";
import { VM18_SKELETON } from "./vm18";
import { PM25_SKELETON } from "./pm25";
import { VM19_SKELETON } from "./vm19";
import { PM26_SKELETON } from "./pm26";
import { VM20_SKELETON } from "./vm20";
import { PM27_SKELETON } from "./pm27";

// As each milestone is authored, add it here. The journey-doc renderer
// reads this map to know which milestones to render assembled vs which
// to mark as "[not yet authored]" placeholders.
export const SKELETON_REGISTRY: Record<string, MilestoneSkeleton> = {
  VM1: VM1_SKELETON,
  PM1: PM1_SKELETON,
  VM2: VM2_SKELETON,
  PM2: PM2_SKELETON,
  VM3: VM3_SKELETON,
  VM4: VM4_SKELETON,
  PM3: PM3_SKELETON,
  PM4: PM4_SKELETON,
  VM5: VM5_SKELETON,
  VM6: VM6_SKELETON,
  PM5: PM5_SKELETON,
  PM6: PM6_SKELETON,
  PM11: PM11_SKELETON,
  VM7: VM7_SKELETON,
  PM7: PM7_SKELETON,
  VM8: VM8_SKELETON,
  VM9: VM9_SKELETON,
  PM12: PM12_SKELETON,
  PM8: PM8_SKELETON,
  PM13: PM13_SKELETON,
  PM9: PM9_SKELETON,
  PM10: PM10_SKELETON,
  PM14: PM14_SKELETON,
  VM10: VM10_SKELETON,
  VM11: VM11_SKELETON,
  VM12: VM12_SKELETON,
  PM15: PM15_SKELETON,
  PM16: PM16_SKELETON,
  PM17: PM17_SKELETON,
  VM13: VM13_SKELETON,
  VM14: VM14_SKELETON,
  VM15: VM15_SKELETON,
  PM18: PM18_SKELETON,
  PM19: PM19_SKELETON,
  PM20: PM20_SKELETON,
  PM21: PM21_SKELETON,
  VM16: VM16_SKELETON,
  VM17: VM17_SKELETON,
  PM22: PM22_SKELETON,
  PM23: PM23_SKELETON,
  PM24: PM24_SKELETON,
  VM18: VM18_SKELETON,
  PM25: PM25_SKELETON,
  VM19: VM19_SKELETON,
  PM26: PM26_SKELETON,
  VM20: VM20_SKELETON,
  PM27: PM27_SKELETON,
};

// Feature flag for the live send path. Default off — flipping to "on"
// in the deployment env makes registered milestones use the assembler.
// Read by lib/services/portal.ts at every send. No restart needed to
// change.
export function isSkeletonModeEnabled(): boolean {
  return process.env.EMAIL_SKELETON_MODE === "on";
}

// Quick lookup for "is this milestone using Model B yet?". Used by both
// the live send path and the snapshot tool.
export function hasSkeleton(milestoneCode: string): boolean {
  return milestoneCode in SKELETON_REGISTRY;
}
