import { cx } from "../ui";

// Every chapter mounts through this so the scroll observer can find it by id and
// the layout rhythm stays consistent.
export function Section({
  id,
  alt,
  flush,
  wide,
  children,
}: {
  id: string;
  alt?: boolean;
  flush?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={`sec-${id}`} className={cx("prop-section", alt && "prop-section--alt", flush && "prop-section--flush")}>
      <div className="prop-container" style={wide ? { maxWidth: 1240 } : undefined}>
        {children}
      </div>
    </section>
  );
}
