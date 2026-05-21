// Client-safe predicate for "is this chain broken" (has a withdrawn link).
//
// Lives in its own file so client components (e.g. ChainDrawer) can value-
// import it without pulling in lib/services/chains.ts — that file imports
// prisma + the milestone glossary (which uses Node's fs), neither of which
// can be bundled into a client component. Type-only imports of ChainV2 from
// chains.ts are fine (TypeScript strips them at build time); it's value
// imports that drag the whole module into the client bundle.

import type { ChainV2 } from "@/lib/services/chains";

export function isChainBroken(chain: ChainV2): boolean {
  return chain.links.some((l) => l.transaction?.status === "withdrawn");
}
