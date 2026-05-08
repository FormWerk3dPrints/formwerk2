'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/lib/firebase/client';
import ProductCard from '@/components/ProductCard';
import AnimatedBackground from '@/components/AnimatedBackground';
import AnimatedBackgroundMobile from '@/components/AnimatedBackgroundMobile';
import ClientsSection from '@/components/ClientsSection';
import AnimatedStudents from '@/components/AnimatedStudents';
import AnimatedSales3 from '@/components/AnimatedSales3';
import AnimatedSales3Mobile from '@/components/AnimatedSales3Mobile';
import { getGlobalStats } from '@/lib/stats/getGlobalStats';

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

export default function Home() {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [salesCount, setSalesCount] = useState<number | null>(null);
  const [animationStarted, setAnimationStarted] = useState(false);
  const salesSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    getGlobalStats().then((stats) => setSalesCount(stats.totalSalesCount));
  }, []);

  useEffect(() => {
    const el = salesSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimationStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [salesCount]);

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
        {/* Estudantes Impactados */}
        <div className="-mt-7">
          <AnimatedStudents count={1250} />
        </div>

        {/* Top Selling Products Section */}
        {isLoadingProducts && (
          <section className="py-12 px-4 bg-white">
            <div className="container mx-auto max-w-6xl">
              <div className="flex flex-col items-center justify-end py-8 md:min-h-[497px]">
                <div className="relative w-48 h-96 md:w-72 md:h-[28rem] -mb-4">
                  <div className="md:hidden absolute inset-0">
                    <AnimatedBackgroundMobile />
                  </div>
                  <div className="hidden md:block absolute inset-0">
                    <AnimatedBackground />
                  </div>
                </div>
                <p className="text-xl text-gray-700 font-bold">Carregando produtos...</p>
              </div>
            </div>
          </section>
        )}

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

        {/* Animação de Vendas – Skeleton */}
        {/*
        {salesCount === null && (
          <section className="relative w-full h-screen overflow-hidden bg-gradient-to-r from-blue-50 to-blue-100">
            {/* Desktop skeleton }
            <div className="hidden md:flex absolute inset-0">
              {/* Left side – text skeleton }
              <div className="w-1/2 flex items-center justify-center px-8">
                <div className="max-w-md w-full space-y-4">
                  <div className="h-14 w-32 bg-blue-200/60 rounded-lg animate-pulse" />
                  <div className="h-8 w-full bg-blue-200/60 rounded-lg animate-pulse" />
                  <div className="h-8 w-4/5 bg-blue-200/60 rounded-lg animate-pulse" />
                </div>
              </div>
              {/* Right side – boxes skeleton }
              <div className="w-1/2 flex items-end justify-center pb-16 gap-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-blue-200/50 rounded animate-pulse"
                    style={{
                      width: 48,
                      height: 40 + i * 22,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Mobile skeleton }
            <div className="md:hidden flex flex-col items-center justify-center h-full px-6 gap-8">
              <div className="w-full max-w-xs space-y-3">
                <div className="h-10 w-24 mx-auto bg-blue-200/60 rounded-lg animate-pulse" />
                <div className="h-6 w-full bg-blue-200/60 rounded-lg animate-pulse" />
                <div className="h-6 w-3/4 mx-auto bg-blue-200/60 rounded-lg animate-pulse" />
              </div>
              <div className="flex items-end gap-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-blue-200/50 rounded animate-pulse"
                    style={{
                      width: 40,
                      height: 32 + i * 18,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Animação de Vendas }
        {salesCount !== null && salesCount > 0 && (
          <section ref={salesSectionRef} className="relative w-full h-screen overflow-hidden bg-gradient-to-r from-blue-50 to-blue-100">
            {/* Desktop: full canvas + text overlay }
            <div className="hidden md:block absolute inset-0">
              <AnimatedSales3 salesCount={salesCount} started={animationStarted} />
            </div>
            <div className={`hidden md:flex absolute inset-y-0 left-0 md:w-1/2 items-center justify-center px-8 py-12 z-10 transition-all duration-1000 ease-out ${animationStarted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}`}>
              <div className="max-w-md">
                <p className="text-3xl md:text-5xl font-bold text-gray-800 leading-tight drop-shadow-[0_0_12px_rgba(255,255,255,1)]">
                  <span className="text-4xl md:text-6xl font-extrabold" style={{ color: '#0D6AA7' }}>{salesCount}</span>{" "}
                  itens já produzidos, equipando as melhores instituições de ensino!
                </p>
              </div>
            </div>
            {/* Mobile: canvas full + text overlay }
            <div className="md:hidden absolute inset-0">
              <AnimatedSales3Mobile salesCount={salesCount} started={animationStarted} />
            </div>
            <div className={`md:hidden absolute inset-0 flex items-start justify-center px-6 pt-10 z-10 pointer-events-none transition-all duration-1000 ease-out ${animationStarted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
              <p className="text-2xl font-bold text-gray-800 leading-tight text-center drop-shadow-[0_0_12px_rgba(255,255,255,1)]">
                <span className="text-3xl font-extrabold" style={{ color: '#0D6AA7' }}>{salesCount}</span>{" "}
                itens já produzidos, equipando as melhores instituições de ensino!
              </p>
            </div>
          </section>
        )}/*}

        {/* Clientes Section */}
        <ClientsSection />

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
                unoptimized
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

        {/* CTA Section */}
        <section className="relative overflow-hidden py-16 px-4 bg-white">
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
