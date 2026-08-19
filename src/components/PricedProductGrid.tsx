'use client';

import ProductCard from '@/components/ProductCard';
import { useProductPrices } from '@/hooks/useProductPrices';

export type PricedGridItem = {
  id: string;
  name: string;
  description: string;
  image: string;
  categoryColor: string;
};

/**
 * Grade de cards com o badge de preço. Existe para que páginas que são server
 * components (ex.: /catalogo/resultados) consigam exibir preço — o preço vem
 * de um hook de cliente, já que depende do login do visitante.
 */
export default function PricedProductGrid({
  items,
  className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8',
  mobileLayout = 'side',
}: {
  items: PricedGridItem[];
  className?: string;
  mobileLayout?: 'stack' | 'side';
}) {
  const { priceLabel } = useProductPrices();

  return (
    <div className={className}>
      {items.map((item) => (
        <ProductCard
          key={item.id}
          id={item.id}
          name={item.name}
          description={item.description}
          price={priceLabel(item.id)}
          image={item.image}
          categoryColor={item.categoryColor}
          mobileLayout={mobileLayout}
        />
      ))}
    </div>
  );
}
