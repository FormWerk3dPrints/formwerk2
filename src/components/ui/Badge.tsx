import type { ReactNode } from "react";

interface BadgeProps {
  children?: ReactNode;
  variant?: "neutral" | "brand" | "success" | "warning" | "error";
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-brand-50 text-brand-700",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
};

export default function Badge({ children, variant = "neutral", className = "" }: BadgeProps) {
  const isSemantic = variant === "success" || variant === "warning" || variant === "error";
  const classes = [
    isSemantic ? variantClasses[variant] : `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
