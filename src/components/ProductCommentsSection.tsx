import { useEffect, useState } from 'react';
import { getProductComments } from '../lib/products/getProductComments';
import { ProductCommentsCard } from '../components/ProductCommentsCard';
import { ProductComment } from '../lib/products/ProductComment';

export function ProductCommentsSection({ productId }: { productId: string }) {
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getProductComments(productId).then((data) => {
      if (mounted) {
        setComments(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [productId]);

  if (loading) return <div className="mt-6">Carregando comentários...</div>;
  return <ProductCommentsCard comments={comments} />;
}
