'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';

const clients = [
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://colegio-rosario.example.com' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'https://colegio-industrial.example.com' },
];

export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-50 to-blue-100 py-8 md:py-12 px-4 md:px-8">
          <div className="container mx-auto max-w-7xl">
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
                <p className="text-base md:text-lg text-gray-700 mb-6 leading-relaxed">
                  A Formwerk é uma empresa dedicada à criação de materiais educacionais 
                  em impressão 3D, desenvolvidos para tornar o processo de alfabetização
                  e aprendizagem mais lúdico, interativo e acessível. Nossos produtos 
                  são voltados para o ensino de Matemática, Inglês, Geografia e Português,
                  oferecendo recursos que estimulam a curiosidade, a criatividade e o raciocínio
                  lógico das crianças.
                </p>
                <p className="text-base md:text-lg text-gray-700 mb-6 leading-relaxed">
                  Nosso compromisso é com a educação de qualidade, unindo tecnologia e inovação pedagógica 
                  para apoiar professores, escolas e famílias no desenvolvimento integral dos alunos. 
                  Na Formwerk, acreditamos que aprender pode – e deve – ser uma experiência prazerosa, 
                  transformadora e inclusiva.
                </p>
                <Link
                  href="/categorias"
                  className="inline-block text-white font-semibold py-3 px-7 rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#0D6AA7' }}
                >
                  Explorar Produtos
                </Link>
              </div>

              {/* Imagem Landing Page */}
              <div className="flex items-center justify-center">
                <Image
                  src="/images/landingpage2.jpg"
                  alt="FORMWERK - Materiais Educacionais 3D"
                  width={400}
                  height={320}
                  className="w-full max-w-[400px] rounded-lg shadow-lg"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Diferenciais Section */}
        <section className="py-16 px-4 bg-white">
          <div className="container mx-auto max-w-4xl">
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
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  //style={{ backgroundColor: '#418b3b' }}
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
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  //style={{ backgroundColor: '#ec373f' }}
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
              <div className="p-6 rounded-lg shadow-lg text-center hover:shadow-xl transition-shadow">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                  //style={{ backgroundColor: '#fbbc3c' }}
                  style={{ backgroundColor: '#0d6aa7' }}
                >
                  ★
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  Qualidade Premium
                </h3>
                <p className="text-gray-600">
                  A durabilidade de nossos materiais é muito superior à produtos de mdf ou eva,
                  longe do sol e da umidaden, é capaz de atingir 10-15 anos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Clientes Section */}
        <section className="py-12 px-4 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
              Nossos Clientes
            </h2>
            <div className="overflow-hidden">
              <div className="clients-marquee gap-10">
                {[...clients, ...clients].map((client, index) => (
                  <a
                    key={`${client.name}-${index}`}
                    href={client.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center"
                  >
                    <Image
                      src={client.src}
                      alt={client.name}
                      width={160}
                      height={80}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
        

        {/* CTA Section */}
        <section className="py-16 px-4" style={{ backgroundColor: '#0D6AA7' }}>
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Pronto para Transformar a Educação?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Conheça nossa coleção completa de produtos educacionais
              personalizados.
            </p>
            <Link
              href="/categorias"
              className="inline-block bg-white text-blue-600 font-semibold py-3 px-8 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Ver Todas as Categorias
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
