// Expanded Email Studio (2026-10) — now fully rolled out. The send path resolves
// the theme (client agency -> business house style -> Sales Progressor default)
// and every director / business owner gets the advanced designer. Kept as a
// single gate function so the mount sites have one switch to flip if we ever need
// to dark it again.

export function emailStudioEnabled(_email: string | null | undefined): boolean {
  return true;
}
