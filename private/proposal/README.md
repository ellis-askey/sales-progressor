# Private proposal assets

This directory is **outside `/public`** on purpose. Nothing here is served as a
static asset, indexed, or publicly cacheable.

## The original PDF

To enable the "Download the original PDF" button in the Boardwalk proposal,
place the prospectus file here:

```
private/proposal/beyond-sales-progression.pdf
```

(Exact path: `PROPOSAL_PDF_RELATIVE` in [`lib/proposal/config.ts`](../../lib/proposal/config.ts).)

It is streamed only to authenticated readers through the gated route
`GET /api/proposal/pdf`, which checks the `proposal_session` cookie, records a
`pdf_download` analytics event, and sets `no-store` + `X-Robots-Tag: noindex`.

If the file is absent, the download button is hidden in the experience and the
route returns a friendly 404 — everything else works without it.

**Do not** move this PDF into `/public`.
