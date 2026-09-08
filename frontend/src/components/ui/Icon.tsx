// Material Symbols Outlined glyph (Design §3.1). Decorative by default (aria-hidden).
export function Icon({
  name,
  className = "",
  size = 20,
  fill = false,
  style,
}: {
  name: string;
  className?: string;
  size?: number;
  fill?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`msym ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        overflow: "hidden",
        flexShrink: 0,
        fontVariationSettings: `"FILL" ${fill ? 1 : 0}, "wght" 500, "GRAD" 0, "opsz" ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
