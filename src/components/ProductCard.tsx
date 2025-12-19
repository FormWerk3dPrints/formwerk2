import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
  id: number;
  name: string;
  description: string;
  price: string;
  image: string;
  categoryColor: string;
}

export default function ProductCard({
  id,
  name,
  description,
  price,
  image,
  categoryColor,
}: ProductCardProps) {
  return (
    <Link href={`/products/${id}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer h-full flex flex-col">
        {/* Image Container */}
        <div
          className="relative h-48 w-full overflow-hidden"
          style={{ backgroundColor: categoryColor + '20' }}
        >
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
          <div
            className="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-white text-sm font-semibold"
            style={{ backgroundColor: categoryColor }}
          >
            {price}
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
            {name}
          </h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
            {description}
          </p>
          <button
            style={{ backgroundColor: categoryColor }}
            className="mt-auto text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity w-full"
          >
            Ver Detalhes
          </button>
        </div>
      </div>
    </Link>
  );
}
