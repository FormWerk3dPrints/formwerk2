import Script from "next/script";

// Reutiliza o Measurement ID já presente no Firebase (GA4 vinculado ao projeto).
// Se preferir um ID separado, defina NEXT_PUBLIC_GA_MEASUREMENT_ID no .env.local.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

/**
 * Google Analytics 4 — App Router compatible.
 * Requer NEXT_PUBLIC_GA_MEASUREMENT_ID no .env.local (ex: G-XXXXXXXXXX).
 * Não renderiza nada se a variável não estiver definida.
 */
export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
