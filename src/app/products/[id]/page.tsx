'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import productsData from '@/data/products.json';

interface Product {
  id: number;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  images: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function ProductDetails() {
  const params = useParams();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carregar dados localmente do JSON
    const foundProduct = productsData.products.find(
      (p: Product) => p.id === parseInt(productId)
    );
    const foundCategory = productsData.categories.find(
      (c: Category) => c.id === foundProduct?.categoryId
    );

    setProduct(foundProduct || null);
    setCategory(foundCategory || null);
    setLoading(false);
  }, [productId]);

  const handlePrevImage = () => {
    if (product) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + product.images.length) % product.images.length
      );
    }
  };

  const handleNextImage = () => {
    if (product) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Carregando...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Produto não encontrado</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
              {/* Carrossel de Imagens */}
              <div className="flex flex-col gap-4">
                {/* Imagem Principal */}
                <div
                  className="relative w-full h-96 rounded-lg overflow-hidden"
                  style={{
                    backgroundColor: category?.color + '20',
                  }}
                >
                  <Image
                    src={product.images[currentImageIndex]}
                    alt={`${product.name} - ${currentImageIndex + 1}`}
                    fill
                    className="object-cover"
                  />

                  {/* Controles do Carrossel */}
                  {product.images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors"
                        aria-label="Imagem anterior"
                      >
                        &#10094;
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 font-bold py-2 px-3 rounded-full transition-colors"
                        aria-label="Próxima imagem"
                      >
                        &#10095;
                      </button>
                    </>
                  )}

                  {/* Indicador de Imagem */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {product.images.length}
                  </div>
                </div>

                {/* Thumbnails */}
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                          currentImageIndex === index
                            ? 'border-blue-500'
                            : 'border-gray-200'
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`Thumbnail ${index + 1}`}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações do Produto */}
              <div className="flex flex-col justify-between">
                {/* Category Badge */}
                {category && (
                  <div
                    className="inline-block px-4 py-2 rounded-full text-white font-semibold w-fit mb-4"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.name}
                  </div>
                )}

                {/* Nome e Preço */}
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 mb-4">
                    {product.name}
                  </h1>
                  <p className="text-3xl font-bold mb-6" style={{ color: category?.color }}>
                    {product.price}
                  </p>
                </div>

                {/* Descrição */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-gray-800 mb-3">
                    Descrição
                  </h2>
                  <p className="text-gray-600 text-lg leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-col gap-4">
                  <a
                    href="https://wa.me/5511999998888"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity text-center"
                    style={{ backgroundColor: category?.color || '#0D6AA7' }}
                  >
                    Entrar em Contato via WhatsApp
                  </a>
                  <a
                    href="tel:+551133334444"
                    className="text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity text-center bg-green-600"
                  >
                    Ligar (11) 3333-4444
                  </a>
                </div>

                {/* Info Adicional */}
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    Informações Importantes
                  </h3>
                  <ul className="text-gray-600 text-sm space-y-2">
                    <li>✓ Produto personalizado conforme necessidade</li>
                    <li>✓ Impressão 3D de alta qualidade</li>
                    <li>✓ Entrega sob encomenda</li>
                    <li>✓ Suporte técnico e orientação de uso</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Voltar ao Início */}
          <div className="mt-12 text-center">
            <a
              href="/categorias"
              className="inline-block text-blue-600 hover:text-blue-800 font-semibold"
            >
              ← Voltar às Categorias
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
