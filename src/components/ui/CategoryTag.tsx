import type { ReactNode, CSSProperties } from "react";

/** Default brand color per catalog category (admin-editable colors take precedence at runtime). */
export const FW_CATEGORIES: Record<string, string> = {
  "Matemática": "var(--color-cat-matematica)",
  "Línguas": "var(--color-cat-linguas)",
  "Ciências da Natureza": "var(--color-cat-natureza)",
  "Ciências Humanas": "var(--color-cat-humanas)",
  "Materiais Diversos": "var(--color-cat-diversos)",
  "Adaptados": "var(--color-cat-adaptados)",
};

interface CategoryTagProps {
  category?: string;
  /** Overrides the category's default color (e.g. an admin-set Firestore color). */
  color?: string;
  /** Soft tinted fill instead of solid. */
  soft?: boolean;
  children?: ReactNode;
  className?: string;
}

export default function CategoryTag({ category, color, soft = false, children, className = "" }: CategoryTagProps) {
  const accent = color || (category ? FW_CATEGORIES[category] : undefined) || "var(--color-brand)";
  const style: CSSProperties = soft
    ? { backgroundColor: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }
    : { backgroundColor: accent, color: "#fff" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${className}`}
      style={style}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: soft ? accent : "rgba(255,255,255,0.85)" }}
      />
      {children || category}
    </span>
  );
}
