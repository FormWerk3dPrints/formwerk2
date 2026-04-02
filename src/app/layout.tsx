import type { Metadata } from "next";
import { Geist, Geist_Mono, Geologica } from "next/font/google";
import "./globals.css";
import ScrollContext from "@/components/ScrollContext";
import SiteLayoutWrapper from "@/components/SiteLayoutWrapper";

const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin"],
  weight: ["700"],
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
  title: "FORMWERK - Materiais Educacionais 3D",
  description: "Criando materiais educacionais personalizados através de impressão 3D",
  icons: {
    icon: "/logo_colorida_vetorial.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body
        className={`${geologica.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ScrollContext>
          <SiteLayoutWrapper>{children}</SiteLayoutWrapper>
        </ScrollContext>
      </body>
    </html>
  );
}
