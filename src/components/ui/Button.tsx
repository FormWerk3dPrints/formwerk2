import Link from "next/link";
import type { ReactNode, MouseEventHandler, CSSProperties } from "react";

interface ButtonProps {
  children?: ReactNode;
  variant?: "primary" | "outline" | "secondary" | "ghost" | "category";
  size?: "sm" | "md" | "lg";
  /** Category color token, used for the "category" variant. */
  color?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  href?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "text-sm px-4 py-2",
  md: "text-base px-8 py-3",
  lg: "text-lg px-10 py-4",
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  secondary: "btn-secondary",
  ghost: "text-brand hover:bg-brand-50",
  category: "text-white",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  color,
  fullWidth = false,
  disabled = false,
  iconLeft,
  iconRight,
  href,
  className = "",
  onClick,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[opacity,transform,background-color] duration-200 ease-out hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100";
  const isTokenVariant = variant === "primary" || variant === "outline" || variant === "secondary";
  const classes = [
    base,
    sizeClasses[size],
    isTokenVariant ? variantClasses[variant] : "",
    variant === "ghost" ? "hover:opacity-90" : "",
    variant === "category" ? "hover:opacity-90" : "",
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style: CSSProperties | undefined = variant === "category" ? { backgroundColor: color } : undefined;

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {iconLeft}
        {children}
        {iconRight}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={classes} style={style}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
