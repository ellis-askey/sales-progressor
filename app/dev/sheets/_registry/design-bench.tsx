"use client";
// Design benches — the REAL Drawer and Modal primitives rendered with a
// skin-driven interior (header + structured sections + fields + footer) that
// follows the chosen design DIRECTION (see presets.tsx). Perfect the look here
// in light + dark, then it's baked into the primitive defaults + adopted as the
// pattern every drawer/modal follows.

import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import type { SheetEntry } from "./types";
import { getPreset, BenchHeader, BenchSections, BenchFooter, type PresetSkin } from "./presets";
import { DEFAULT_SELECTION, getDarkHeader } from "./design";
import type { DesignSelection } from "./types";

// The Ribbon layout is shared; in dark mode the bright coral band is swapped
// for the chosen dark-header treatment (headerStyleId, dark selection only).
function effectiveSkin(sel: DesignSelection): PresetSkin {
  const base = getPreset(sel.presetId).skin;
  if (!sel.headerStyleId) return base;
  const dh = getDarkHeader(sel.headerStyleId);
  return {
    ...base,
    headerWrap: { ...base.headerWrap, background: dh.bg },
    kicker: { ...(base.kicker ?? {}), color: dh.kicker },
  };
}

const BENCH_NOTE =
  "The real primitive rendered in the chosen direction. Pick a direction (Editorial / Warm / Bento / Contrast / Frost) in the inspector, fine-tune surface + footer, and design light + dark independently. Tell me the winner and it becomes the precedent for every drawer/modal.";

export const DESIGN_BENCH_ENTRIES: SheetEntry[] = [
  {
    id: "bench-drawer",
    name: "Drawer direction",
    type: "drawer",
    area: "Global chrome",
    usedIn: "Design bench · the shared Drawer primitive",
    file: "components/ui/Drawer.tsx",
    componentName: "Drawer",
    note: BENCH_NOTE,
    preview: "overlay",
    designable: true,
    states: [{ id: "default", label: "Default", hint: "header · structured body · action footer" }],
    render: ({ open, onClose, design }) => {
      const sel = design ?? DEFAULT_SELECTION;
      const skin = effectiveSkin(sel);
      return (
        <Drawer
          open={open}
          onClose={onClose}
          ariaLabel="Drawer design bench"
          size="lg"
          surfaceVariant={sel.surfaceVariant ?? undefined}
          footerVariant={sel.footerVariant}
          closeTone="onDark"
        >
          <Drawer.Header style={skin.headerWrap}>
            <BenchHeader skin={skin} />
          </Drawer.Header>
          <Drawer.Body style={skin.bodyWrap}>
            <BenchSections skin={skin} />
          </Drawer.Body>
          <Drawer.Footer>
            <BenchFooter />
          </Drawer.Footer>
        </Drawer>
      );
    },
  },
  {
    id: "bench-modal",
    name: "Modal direction",
    type: "modal",
    area: "Global chrome",
    usedIn: "Design bench · the shared Modal primitive",
    file: "components/ui/Modal.tsx",
    componentName: "Modal",
    note: BENCH_NOTE,
    preview: "overlay",
    designable: true,
    states: [{ id: "default", label: "Default", hint: "header · structured body · action footer" }],
    render: ({ open, onClose, design }) => {
      const sel = design ?? DEFAULT_SELECTION;
      const skin = effectiveSkin(sel);
      return (
        <Modal
          open={open}
          onClose={onClose}
          ariaLabel="Modal design bench"
          size="lg"
          surfaceVariant={sel.surfaceVariant ?? undefined}
          footerVariant={sel.footerVariant}
          closeTone="onDark"
        >
          <Modal.Header style={skin.headerWrap}>
            <BenchHeader skin={skin} />
          </Modal.Header>
          <Modal.Body style={skin.bodyWrap}>
            <BenchSections skin={skin} />
          </Modal.Body>
          <Modal.Footer>
            <BenchFooter />
          </Modal.Footer>
        </Modal>
      );
    },
  },
];
