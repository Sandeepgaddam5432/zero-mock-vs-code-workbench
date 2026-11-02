import type { CSSProperties } from "react";

export function Codicon({ name, className = "", style, size }: { name: string; className?: string; style?: CSSProperties; size?: number }) {
  return <span aria-hidden className={`codicon codicon-${name} ${className}`} style={size ? { fontSize: size, ...style } : style} />;
}
