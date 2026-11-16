// A person's job title as a role label, or undefined when the title adds nothing
// worth showing. Bare "Director" / "Negotiator" are suppressed — on a file their
// name alone reads cleanly and the role pill would be noise. Shared by the Files
// list "Handled by" column and the file-preview drawer's People card so the same
// person never shows two different labels across the two surfaces.
export function jobTitleLabel(jobTitle?: string | null): string | undefined {
  const t = jobTitle?.trim();
  if (!t) return undefined;
  if (/^(director|negotiator)$/i.test(t)) return undefined;
  return t;
}
