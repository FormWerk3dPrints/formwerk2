import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** When true, the card lifts (shadow-xl) and scales 1.02 on hover. */
  interactive?: boolean;
  className?: string;
}

export default function Card({ children, interactive = false, className = "", ...rest }: CardProps) {
  const classes = [
    "rounded-lg bg-white p-6 shadow-lg transition-[box-shadow,transform] duration-200 ease-out",
    interactive ? "hover:shadow-xl hover:scale-[1.02] motion-reduce:hover:scale-100" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
