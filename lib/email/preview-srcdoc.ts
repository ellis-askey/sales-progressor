// Restyle a rendered email's HTML for ON-SCREEN preview only: white page + the
// fixed 560px inbox card made fluid, so it fills its container instead of
// sitting thin. The real send is untouched — this only affects what renders in
// a preview iframe. Our templates wrap the body in <table width="560"> on a
// grey page, so overriding those two things is all it takes. Injected into
// <head> so it wins.
//
// Shared by every "true email preview" surface (the automated-emails detail
// drawer, the chase-timeline next-email drawer, …) so they render identically.
export function previewSrcDoc(html: string): string {
  const css = '<style>html,body{background:#ffffff!important;margin:0!important;}table[width="560"]{width:100%!important;}</style>';
  return html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
}
