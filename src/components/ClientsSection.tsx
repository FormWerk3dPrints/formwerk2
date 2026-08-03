'use client';

import Image from 'next/image';

// Clientes reais - apenas 4 por enquanto
const clientsBase = [
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.instagram.com/e.e.bnossasradorosario/' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  //{ name: 'Instituto Autismo Lages', src: '/images/clients/autismo_lages.jpg', href: 'https://www.instagram.com/institutoautismolagesoficial/' },
  { name: 'Colégio Sigma Lages', src: '/images/clients/SIGMA.jpeg', href: 'https://temnaweb.com.br/' },
  { name: 'SESI', src: '/images/clients/sesiescola.png', href: 'https://www.escolasesisc.com.br/' },
  { name: 'APAS', src: '/images/clients/APAS.png', href: 'https://www.instagram.com/apas.lages/' },
  { name: 'APAE', src: '/images/clients/APAE.png', href: 'https://www.apaelages.org.br/'},
  { name: 'CISAMURES', src: '/images/clients/cisamures.jpeg', href: 'https://cisamures.sc.gov.br'},
];
// Repetir 6x garante preenchimento em ultrawide (36 itens, duplicados no JSX = 72)
const clients = Array(6).fill(clientsBase).flat();

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
                  unoptimized
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
