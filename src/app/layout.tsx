import type { Metadata } from "next";
import { Geist, Geist_Mono, Geologica } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ScrollContext from "@/components/ScrollContext";
import SiteLayoutWrapper from "@/components/SiteLayoutWrapper";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import InspectGuard from "@/components/InspectGuard";
import { CONTRAST_INIT_SCRIPT } from "@/lib/a11y/contrast";

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FormWerk - Materiais Educacionais Concretos",
  description: "Criando materiais educacionais personalizados através de impressão 3D",
  // Sem icons aqui de propósito: o Next usa src/app/favicon.ico sozinho.
  // Antes isto apontava para logo_colorida_vetorial.svg, um arquivo de 10,7 MB
  // com 2.484 caminhos, baixado em toda página só para o ícone da aba.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: o script do <head> pode marcar data-contrast
    // no <html> antes de o React hidratar.
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CONTRAST_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geologica.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GoogleAnalytics />
        <ScrollContext>
          <SiteLayoutWrapper>{children}</SiteLayoutWrapper>
        </ScrollContext>
        {/* VLibras, tradutor de Português para Libras do Governo Federal.
            O script oficial cria sozinho o botão flutuante (num shadow DOM,
            fora da árvore do React) e só baixa o avatar quando alguém clica.
            Fica no layout raiz para não ser recriado a cada navegação. */}
        <Script src="https://vlibras.gov.br/app/vlibras-plugin.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
