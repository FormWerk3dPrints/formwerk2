'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function QuemSomos() {
  return (
    <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-blue-100 py-8 md:py-12 px-4 md:px-8">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-center">
            {/* Conteúdo */}
            <div>
              <h1
                className="text-4xl md:text-5xl font-bold mb-3"
                style={{ color: '#0D6AA7' }}
              >
                FormWerk
              </h1>
              <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4">
                Educação em Três Dimensões 
              </h2>
              <div
                id="hero-text"
                className="text-base md:text-lg text-gray-700 leading-relaxed mb-4 md:mb-6"
              >
                <p>
                  A Formwerk é uma empresa dedicada à criação de materiais educacionais 
                  em impressão 3D, desenvolvidos para tornar o processo de alfabetização
                  e aprendizagem mais lúdico, interativo e acessível. Nossos produtos 
                  são voltados para o ensino de Matemática, Inglês, Geografia e Português,
                  oferecendo recursos que estimulam a curiosidade, a criatividade e o raciocínio
                  lógico das crianças.
                </p>
                <p className="mt-6">
                  Nossa responsabilidade vai além da sala de aula. Adotamos práticas alinhadas aos princípios
                  ESG: utilizamos filamento PLA, um material à base de vegetais, atóxico e biodegradável,
                  reduzindo nosso impacto ambiental. No campo social, desenvolvemos materiais em Libras e
                  colaboramos com a APAE (Associação de Pais e Amigos dos Excepcionais) e a APAS (Associação
                  de Pais e Amigos dos Surdos), tornando o aprendizado acessível a todas as crianças,
                  independentemente de suas necessidades.
                </p>
                <p className="mt-6">
                  Nosso compromisso é com a educação de qualidade, unindo tecnologia e inovação pedagógica
                  para apoiar professores, escolas e famílias no desenvolvimento integral dos alunos.
                  Na Formwerk, acreditamos que aprender pode – e deve – ser uma experiência prazerosa,
                  transformadora e inclusiva.
                </p>
              </div>

              <Link
                href="/catalogo"
                className="inline-block text-white font-semibold py-3 px-7 rounded-lg hover:opacity-90 transition-opacity btn-hover-expand"
                style={{ backgroundColor: '#0D6AA7' }}
              >
                Explorar Produtos
              </Link>
            </div>

            {/* Logo */}
            <div className="flex items-center justify-center">
              <Image
                src="/images/foto_gestores.jpg"
                alt="FORMWERK - Gestores"
                width={500}
                height={400}
                className="w-full max-w-[500px] rounded-xl object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
