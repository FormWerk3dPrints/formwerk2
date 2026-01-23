'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="shadow-md fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#0D6AA7' }}>
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between text-white">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo_branca_vetorial.svg"
            alt="FormWerk"
            width={35}
            height={35}
            priority
          />
          <div className="text-2xl font-bold">FormWerk</div>
        </Link>

        {/* Desktop Navigation Menu */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/catalogo"
            className="text-white hover:text-blue-100 transition-colors font-medium"
          >
            Catálogo
          </Link>
          <Link
            href="/sobre"
            className="text-white hover:text-blue-100 transition-colors font-medium"
          >
            Sobre Nós
          </Link>
          <a
            href="#contato"
            className="text-white hover:text-blue-100 transition-colors font-medium"
          >
            Contato
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-label="Menu de navegação"
        >
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
              isMobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-white my-1 transition-all duration-300 ${
              isMobileMenuOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
              isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
            }`}
          />
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          isMobileMenuOpen ? 'max-h-48' : 'max-h-0'
        }`}
        style={{ backgroundColor: '#0D6AA7' }}
      >
        <div className="container mx-auto px-4 pb-4 flex flex-col gap-3">
          <Link
            href="/catalogo"
            className="text-white hover:text-blue-100 transition-colors font-medium py-2 border-t border-white/20"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Catálogo
          </Link>
          <Link
            href="/sobre"
            className="text-white hover:text-blue-100 transition-colors font-medium py-2 border-t border-white/20"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Sobre Nós
          </Link>
          <a
            href="#contato"
            className="text-white hover:text-blue-100 transition-colors font-medium py-2 border-t border-white/20"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Contato
          </a>
        </div>
      </div>
    </header>
  );
}
