import type { ButtonHTMLAttributes } from "react";

export function Button({
  variant = "solid",
  className = "",
  ...rest
}: { variant?: "solid" | "ghost" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50";
  const styles =
    variant === "ghost"
      ? "text-on-background/80 hover:bg-surface-high"
      : "bg-primary text-white hover:brightness-110";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
