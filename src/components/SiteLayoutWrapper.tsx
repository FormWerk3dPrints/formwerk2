'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import FloatingWhatsApp from './FloatingWhatsApp';

export default function SiteLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <>
        <Header />
        <div className="pt-20">{children}</div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="pt-20">{children}</div>
      <FloatingWhatsApp />
      <Footer />
    </>
  );
}
