import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "surface" | "light" | "ghost";
type Size = "lg" | "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent font-bold text-bg disabled:bg-line disabled:text-faint",
  secondary:
    "border border-line-strong bg-transparent font-semibold text-fg disabled:text-faint",
  surface:
    "border border-line bg-surface font-medium text-fg disabled:text-faint",
  light: "bg-fg font-bold text-bg disabled:bg-line disabled:text-faint",
  ghost: "bg-transparent text-muted hover:text-fg",
};

const SIZES: Record<Size, string> = {
  lg: "h-14 rounded-xl px-5 text-[17px]",
  md: "h-11 rounded-[10px] px-4 text-sm",
  sm: "h-9 rounded-lg px-3 text-[13px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={`text-muted hover:text-fg inline-flex size-11 shrink-0 cursor-pointer items-center justify-center transition-colors ${className}`}
      {...props}
    />
  );
}
