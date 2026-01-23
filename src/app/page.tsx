'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';
import ProductCard from '@/components/ProductCard';

interface TopProduct {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryColor: string;
  imageUrls: string[];
  mainImageUrl?: string;
  salesCount: number;
  createdAt: Date;
}

interface Category {
  id: string;
  color: string;
}

const clients = [
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
];

export default function Home() {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    async function fetchTopProducts() {
      try {
        // Buscar categorias para obter as cores
        const categoriesSnap = await getDocs(
          query(collection(firestoreDb, 'categories'), where('active', '==', true))
        );
        const categoriesMap = new Map<string, Category>();
        categoriesSnap.docs.forEach((doc) => {
          const data = doc.data();
          categoriesMap.set(doc.id, {
            id: doc.id,
            color: typeof data.color === 'string' ? data.color : '#0D6AA7',
          });
        });

        // Buscar produtos ativos
        const productsSnap = await getDocs(
          query(
            collection(firestoreDb, 'products'),
            where('active', '==', true)
          )
        );

        const products: TopProduct[] = productsSnap.docs.map((doc) => {
          const data = doc.data();
          const imageUrls = Array.isArray(data.imageUrls)
            ? (data.imageUrls as string[]).filter(Boolean)
            : [];
          const category = categoriesMap.get(data.categoryId);

          return {
            id: doc.id,
            name: String(data.name ?? ''),
            description: String(data.description ?? ''),
            categoryId: String(data.categoryId ?? ''),
            categoryColor: category?.color ?? '#0D6AA7',
            imageUrls,
            mainImageUrl: typeof data.mainImageUrl === 'string' ? data.mainImageUrl : undefined,
            salesCount: typeof data.salesCount === 'number' ? data.salesCount : 0,
            createdAt: data.createdAt?.toDate?.() ?? new Date(0),
          };
        });

        // Ordenar: salesCount desc, depois createdAt desc (mais recentes primeiro em caso de empate)
        products.sort((a, b) => {
          if (b.salesCount !== a.salesCount) {
            return b.salesCount - a.salesCount;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        // Pegar os 6 primeiros
        setTopProducts(products.slice(0, 6));
      } catch (error) {
        console.error('Erro ao buscar produtos mais vendidos:', error);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    fetchTopProducts();
  }, []);

  return (
    <>
      <main>
        {/* Top Selling Products Section */}
        {!isLoadingProducts && topProducts.length > 0 && (
          <section className="py-12 px-4 bg-white">
            <div className="container mx-auto max-w-6xl">
              <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
                Nossos produtos mais vendidos:
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {topProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    description={product.description}
                    price=""
                    image={product.mainImageUrl || product.imageUrls[0] || '/images/placeholder.png'}
                    categoryColor={product.categoryColor}
                    compact
                  />
                ))}
              </div>
              <div className="text-center mt-8">
                <Link
                  href="/catalogo"
                  className="inline-block text-white font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity btn-hover-expand"
                  style={{ backgroundColor: '#0D6AA7' }}
                >
                  Ver Todos os Produtos
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Diferenciais Section */}
        <section className="relative overflow-hidden py-16 px-4 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="container mx-auto max-w-4xl relative z-10">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-800 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
              <span className="md:whitespace-nowrap">Por que Escolher a</span>
              <Image
                src="/logo_colorida_vetorial.svg"
                alt="FormWerk"
                width={35}
                height={35}
                className="hidden md:inline-block"
              />
              <span className="md:whitespace-nowrap">FormWerk?</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 */}
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow bg-white card-hover-expand-strong">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: '#0d6aa7' }}
                >
                  ✓
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  Personalização Completa
                </h3>
                <p className="text-gray-600">
                  Cada produto é customizável de acordo com as necessidades
                  específicas da sua instituição, como cores e tamanhos!
                </p>
              </div>
              
              {/* Card 2 */}
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow bg-white card-hover-expand-strong">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: '#0d6aa7' }}
                >
                  ♻
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  Impressão 3D de Qualidade 
                </h3>
                <p className="text-gray-600">
                  Utilizamos filamentos PLA, um material plástico à base de vegetais,
                  atóxico e biodegradável, garantindo segurança e sustentabilidade!
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow bg-white card-hover-expand-strong">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: '#0d6aa7' }}
                >
                  ★
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  Qualidade Premium
                </h3>
                <p className="text-gray-600">
                  A durabilidade de nossos materiais é muito superior à produtos de mdf ou eva,
                  longe do sol e da umidade, é capaz de atingir 5-25 anos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Clientes Section */}
        <section className="py-12 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
              Nossos Clientes:
            </h2>
          </div>

          {/* Full-bleed marquee (goes edge-to-edge) */}
          <div className="relative left-1/2 w-screen -translate-x-1/2">
            <div className="clients-marquee-mask overflow-hidden">
              <div className="clients-marquee gap-10">
                {[...clients, ...clients].map((client, index) => (
                  <a
                    key={`${client.name}-${index}`}
                    href={client.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-xl overflow-hidden bg-white ring-1 ring-gray-200"
                  >
                    <Image
                      src={client.src}
                      alt={client.name}
                      width={80}
                      height={80}
                      className="block"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
        

        {/* CTA Section */}
        <section className="relative overflow-hidden py-16 px-4 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6" style={{ color: '#000000ff' }}>
              Pronto para Transformar a Educação?
            </h2>
            <p className="text-xl text-gray-700 mb-8">
              Conheça os principais produtos para a educação lúdica!
            </p>
            <Link
              href="/catalogo"
              className="inline-block text-white font-semibold py-3 px-8 rounded-lg hover:opacity-90 transition-opacity btn-hover-expand"
              style={{ backgroundColor: '#0D6AA7' }}
            >
              Ver Todas as Categorias
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
