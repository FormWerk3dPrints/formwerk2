import Image from "next/image";

interface TestimonialCardProps {
  name: string;
  role: string;
  quote: string;
  /** Avatar image URL. If absent, `initials` render on a brand-blue disc. */
  imageUrl?: string;
  initials?: string;
  /** Clamp the quote to 4 lines (default true). */
  clamp?: boolean;
  className?: string;
}

export default function TestimonialCard({
  name,
  role,
  quote,
  imageUrl,
  initials,
  clamp = true,
  className = "",
}: TestimonialCardProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-gray-100 bg-white p-5 text-center shadow-lg ${className}`}
    >
      {imageUrl ? (
        <div className="mb-3 h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-brand-100">
          <Image src={imageUrl} alt={name} width={64} height={64} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="mb-3 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-brand-100 bg-brand text-lg font-bold text-white">
          {initials}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900">{name}</h3>
      <p className="mt-1 mb-3 text-xs font-medium text-brand">{role}</p>
      <p className={`text-sm leading-relaxed text-gray-600 ${clamp ? "line-clamp-4" : ""}`}>&ldquo;{quote}&rdquo;</p>
    </div>
  );
}
