'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Assinatura() {
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
                Assinatura
              </h1>
              <div
                id="hero-text"
                className="text-base md:text-lg text-gray-700 leading-relaxed mb-4 md:mb-6"
              >
                <ul className="list-disc list-inside space-y-3" style={{ color: '#0D6AA7' }}>
                  <li>
                    <span style={{ color: '#4B5563' }}>
                      2 materiais entregues todo mês, entregues em seu endereço.
                    </span>
                  </li>
                  <li>
                    <span style={{ color: '#4B5563' }}>
                      Material de exploração e guia de atividades.
                    </span>
                  </li>
                  <li>
                    <span style={{ color: '#4B5563' }}>
                      Seguro contra perda de itens.
                    </span>
                  </li>
                </ul>
              </div>

              <Link
                href="/"
                className="inline-block text-white font-semibold py-3 px-7 rounded-lg hover:opacity-90 transition-opacity btn-hover-expand"
                style={{ backgroundColor: '#0D6AA7' }}
              >
                Voltar ao Início
              </Link>
            </div>

            {/* Imagem */}
            <div className="flex items-center justify-center">
              <Image
                src="/logo_colorida_vetorial.svg"
                alt="logo - FormWerk"
                width={300}
                height={300}
                className="w-full max-w-[300px] rounded-lg"
                priority
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
