import type { ReactNode } from "react";

export function GlassPanel({
  level = 2,
  className = "",
  children,
  ...rest
}: {
  level?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const glass = level === 4 ? "glass-4" : level === 3 ? "glass-3" : "glass-2";
  return (
    <div className={`${glass} rounded-hud ${className}`} {...rest}>
      {children}
    </div>
  );
}
