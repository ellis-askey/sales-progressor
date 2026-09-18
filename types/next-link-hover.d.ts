// Type augmentation (instant-clicks slice, 2026-09-18).
//
// The App Router runtime implementation of next/link supports the
// `unstable_dynamicOnHover` prop — "(unstable) Switch to a full prefetch on
// hover. Effectively the same as updating the prefetch prop to `true` in a
// mouse event." (next/dist/client/app-dir/link.d.ts). The PUBLIC next/link
// typings, however, still re-export the pages-flavoured declaration from
// next/dist/client/link, which lacks the prop — so property-row links using
// it fail tsc despite working at runtime.
//
// This augments the public declaration with the same optional prop. Delete
// this file once a Next upgrade exposes the prop on next/link directly
// (tsc will flag the then-duplicate property if the shapes ever diverge).
// The export makes this file a MODULE, so the declare block below merges
// into (augments) the existing declaration instead of shadowing it.
export {};

declare module "next/dist/client/link" {
  interface LinkProps<RouteInferType> {
    /** (unstable) Switch to a full prefetch on hover — App Router only. */
    unstable_dynamicOnHover?: boolean;
  }
}
