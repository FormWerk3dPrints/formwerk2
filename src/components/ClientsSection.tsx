'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

// Clientes reais - apenas 4 por enquanto
const clientsBase = [
  { name: 'Colégio Rosário Lages', src: '/images/clients/rosario_lages.jpg', href: 'https://www.instagram.com/e.e.bnossasradorosario/' },
  { name: 'Colégio Industrial Lages', src: '/images/clients/industrial_lages.jpg', href: 'http://cedupindustrialdelages.com.br/' },
  //{ name: 'Instituto Autismo Lages', src: '/images/clients/autismo_lages.jpg', href: 'https://www.instagram.com/institutoautismolagesoficial/' },
  { name: 'Colégio Sigma Lages', src: '/images/clients/SIGMA.jpeg', href: 'https://temnaweb.com.br/' },
  { name: 'SESI', src: '/images/clients/sesiescola.png', href: 'https://www.escolasesisc.com.br/' },
  { name: 'APAS', src: '/images/clients/APAS.png', href: 'https://www.instagram.com/apas.lages/' },
  { name: 'APAE', src: '/images/clients/APAE.png', href: 'https://www.apaelages.org.br/'},
  { name: 'CISAMURES', src: '/images/clients/cisamures.png', href: 'https://cisamures.sc.gov.br'},
  { name: 'Santa Rosa', src: '/images/clients/santarosa.png', href: 'https://www.eusousantarosa.com.br/'},
  //{ name: 'SION', src: '/images/clients/SION.png', href: 'https://sioncuritiba.com.br'},
];
// Largura de cada logo no letreiro: 64px da imagem + 40px de gap-10.
const LOGO_SLOT = 104;

export default function ClientsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  // Quantas vezes a lista se repete. O letreiro desliza metade da faixa, então
  // cada metade precisa ser ao menos tão larga quanto a tela. Antes eram 6
  // cópias fixas (84 elementos no DOM) para dar conta de ultrawide; agora a
  // conta é feita pela largura real, e numa tela comum ficam bem menos.
  const [copias, setCopias] = useState(3);
  const [foraDaTela, setForaDaTela] = useState(false);

  useEffect(() => {
    const calcular = () => {
      const larguraDaLista = clientsBase.length * LOGO_SLOT;
      setCopias(Math.max(2, Math.ceil(window.innerWidth / larguraDaLista) + 1));
    };
    calcular();
    window.addEventListener('resize', calcular);
    return () => window.removeEventListener('resize', calcular);
  }, []);

  // Fora da tela a animação para: senão o navegador segue compondo uma camada
  // de vários milhares de pixels de largura durante a página inteira.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setForaDaTela(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const clients = useMemo(() => Array(copias).fill(clientsBase).flat(), [copias]);

  return (
    <section ref={sectionRef} className="py-12 bg-white">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Nossos Clientes:
        </h2>
      </div>

      {/* Full-bleed marquee (goes edge-to-edge).
          No alto contraste vira uma grade parada (globals.css): as cópias do
          loop levam data-contrast-hide, e cada cliente aparece uma vez só.
          data-contrast-keep mantém o fundo branco atrás dos logos. */}
      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <div className="clients-marquee-mask overflow-hidden">
          <div className={`clients-marquee gap-10 ${foraDaTela ? 'is-paused' : ''}`}>
            {[...clients, ...clients].map((client, index) => {
              // Só a primeira volta da lista é real; o resto existe para o
              // efeito contínuo e fica fora do teclado e do leitor de tela.
              const repetido = index >= clientsBase.length;
              return (
                <a
                  key={`${client.name}-${index}`}
                  data-contrast-hide={repetido || undefined}
                  data-contrast-keep
                  href={client.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden={repetido || undefined}
                  tabIndex={repetido ? -1 : undefined}
                  className="flex items-center justify-center rounded-xl overflow-hidden bg-white ring-1 ring-gray-200"
                >
                  {/* Sem unoptimized: os arquivos originais chegam a 121 KB
                      para um logo exibido a 64px. */}
                  <Image
                    src={client.src}
                    alt={client.name}
                    width={80}
                    height={80}
                    className="block"
                  />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
