'use client';

import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { useState } from 'react';
import productsData from '@/data/products.json';

interface Category {
  id: string;
  name: string;
  color: string;
  description: string;
}

interface Product {
  id: number;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  images: string[];
}

export default function Categorias() {
  const categories = productsData.categories as Category[];
  const products = productsData.products as Product[];
  const [selectedCategory, setSelectedCategory] = useState<string>(() => categories[0]?.id ?? '');

  const filteredProducts = products.filter(
    (product) => product.categoryId === selectedCategory
  );

  const selectedCategoryData = categories.find(
    (cat) => cat.id === selectedCategory
  );

  if (!categories.length) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-xl text-gray-600">Nenhuma categoria encontrada.</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
            Produtos por Categoria
          </h1>
          <p className="text-gray-600 text-center mb-12">
            Explore nossos principais produtos organizados por categoria!
          </p>

          {/* Category Tabs */}
          <div className="mb-12">
            <div className="flex flex-wrap gap-3 md:gap-4 mx-auto justify-center md:justify-center">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-semibold transition-all text-sm md:text-base btn-hover-expand ${
                    selectedCategory === category.id
                      ? 'text-white shadow-lg'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                  }`}
                  style={{
                    backgroundColor:
                      selectedCategory === category.id ? category.color : 'white',
                    borderColor:
                      selectedCategory === category.id ? category.color : 'rgb(229, 231, 235)',
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Category Description */}
          {selectedCategoryData && (
            <div
              className="p-6 rounded-lg mb-8 text-white"
              style={{ backgroundColor: selectedCategoryData.color }}
            >
              <h2 className="text-2xl font-bold mb-2">
                {selectedCategoryData.name}
              </h2>
              <p>{selectedCategoryData.description}</p>
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  description={product.description}
                  price={product.price}
                  image={product.images[0]}
                  categoryColor={
                    selectedCategoryData?.color || '#0D6AA7'
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl text-gray-600">
                Nenhum produto encontrado nesta categoria.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
