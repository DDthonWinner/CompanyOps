import "./brandLogo.css";

// The shared CompanyOps wordmark — the same "C↗" mark + CompanyOps lockup used on the
// intro page — so branding stays consistent across the app chrome. Colors inherit from
// the surrounding text (currentColor) so it reads on both the dark hero and the light
// top bar. Pass `note` for the full hero tagline lockup; omit it for compact chrome.
export function BrandLogo({
  note,
  onClick,
  title,
  className = "",
  testId,
}: {
  note?: string;
  onClick?: () => void;
  title?: string;
  className?: string;
  testId?: string;
}) {
  const inner = (
    <>
      <span className="brand-logo-mark" aria-hidden>
        C<span className="brand-logo-arrow">↗</span>
      </span>
      <span className="brand-logo-word">CompanyOps</span>
      {note && <span className="brand-logo-note">{note}</span>}
    </>
  );
  const cls = `brand-logo ${onClick ? "brand-logo--button" : ""} ${className}`.trim();
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title} aria-label={title ?? "CompanyOps"} data-testid={testId}>
      {inner}
    </button>
  ) : (
    <span className={cls} data-testid={testId}>{inner}</span>
  );
}
