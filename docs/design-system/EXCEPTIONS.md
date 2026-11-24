# Protected behaviours & exceptions

Deliberate, often invisible refinements in existing components that **must
survive** shared/canonical updates — automatic capitalisation, input
sanitisation, whitespace trimming, currency/date formatting, conditional labels,
validation, keyboard behaviour, responsive handling, accessibility refinements,
context-specific styling, custom loading, and the like.

**Empty** — populated as components are reviewed. When two existing
implementations behave differently, record both and flag it; never silently
merge or override either.

Also surfaced in the workspace: each component entry has a collapsed
**"Existing Behaviour & Exceptions"** section driven by these records
(`EntryException` in `app/dev/components/_ds/registry.ts`).

---

## Template

```
### <Component> — <behaviour>
- **What:** the exact behaviour (e.g. "trims + title-cases on blur").
- **Where it originates:** file path / function.
- **Scope:** shared across usages | specific to one usage.
- **Protected because:** why it must not be lost.
- **Differences:** if implementations diverge, document each and the open question.
```
