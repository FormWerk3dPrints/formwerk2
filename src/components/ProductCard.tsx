import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  categoryColor: string;
  compact?: boolean;
  mobileLayout?: 'stack' | 'side';
}

export default function ProductCard({
  id,
  name,
  description,
  price,
  image,
  categoryColor,
  compact = false,
  mobileLayout = 'stack',
}: ProductCardProps) {
  void price;//PREÇO REMOVIDO

  const isMobileSideLayout = mobileLayout === 'side';

  const imageHeightClass = compact ? 'md:h-40' : 'md:h-48';
  const paddingClass = isMobileSideLayout
    ? compact
      ? 'p-3 md:p-3'
      : 'p-3 md:p-4'
    : compact
      ? 'p-3'
      : 'p-4';
  const titleClass = compact ? 'text-base' : 'text-lg';
  const descriptionClass = compact ? 'text-xs' : 'text-sm';
  const titleMinHeightClass = compact ? 'md:min-h-[3rem]' : 'md:min-h-[3.5rem]';
  const descriptionMinHeightClass = compact ? 'md:min-h-[3.25rem]' : 'md:min-h-[3.75rem]';
  const buttonPaddingClass = compact ? 'py-2 px-3' : 'py-2 px-4';

  return (
    <Link href={`/catalogo/${id}`} className="block h-full">
      <div
        className={`bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer h-full flex card-hover-expand group ${
          isMobileSideLayout ? 'flex-row md:flex-col' : 'flex-col'
        }`}
      >
        {/* Image Container */}
        <div
          className={`relative overflow-hidden aspect-square ${imageHeightClass} ${
            isMobileSideLayout ? 'w-28 shrink-0 md:w-full' : 'w-full'
          }`}
          style={{ backgroundColor: categoryColor + '20' }}
        >
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105 motion-reduce:transition-none"
          />
          {/*PREÇO REMOVIDO
          <div
            className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-white text-sm font-semibold"
            style={{ backgroundColor: categoryColor }}
          >
            {price}
          </div>
          */}
        </div>

        {/* Content Container */}
        <div className={`${paddingClass} flex flex-col flex-grow`}>
          <h3 className={`${titleClass} font-semibold text-gray-800 mb-2 line-clamp-2 ${titleMinHeightClass}`}>
            {name}
          </h3>
          <p className={`text-gray-600 ${descriptionClass} mb-4 line-clamp-3 ${descriptionMinHeightClass} flex-grow`}>
            {description}
          </p>
          <button
            style={{ backgroundColor: categoryColor }}
            className={`mt-auto text-white font-semibold ${buttonPaddingClass} rounded-lg hover:opacity-90 transition-opacity w-full`}
          >
            Ver Detalhes
          </button>
        </div>
      </div>
    </Link>
  );
}
