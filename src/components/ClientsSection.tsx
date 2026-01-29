'use client';

import Image from 'next/image';

// Clientes reais - apenas 2 por enquanto
const clientsBase = [
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.facebook.com/people/EEB-Nossa-Senhora-do-Ros%C3%A1rio/100082839357407' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  { name: 'Instituto Autismo Lages', src: '/images/clients/autismo_lages.jpg', href: 'https://www.instagram.com/institutoautismolagesoficial/' },
];
// Repetir 20x garante preenchimento em ultrawide (40 itens, duplicados no JSX = 80)
const clients = Array(20).fill(clientsBase).flat();

export default function ClientsSection() {
  return (
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
  );
}
