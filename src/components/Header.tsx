import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="shadow-md sticky top-0 z-50" style={{ backgroundColor: '#0D6AA7' }}>
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

        {/* Navigation Menu */}
        <div className="flex items-center gap-8">
          <Link
            href="/categorias"
            className="text-white hover:text-blue-100 transition-colors font-medium"
          >
            Categorias
          </Link>
          {/* Native anchor so the hash scroll is handled by the browser (works with global smooth scroll). */}
          <a
            href="#contato"
            className="text-white hover:text-blue-100 transition-colors font-medium"
          >
            Contato
          </a>
        </div>
      </nav>
    </header>
  );
}
