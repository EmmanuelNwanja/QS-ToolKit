import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon — SVG for all modern browsers (fixes favicon.ico 404) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme & mobile */}
        <meta name="theme-color" content="#1a3c5e" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="QSToolkit" />

        {/* SEO */}
        <meta name="description" content="QSToolkit — Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices & Project Tracking." />
        <meta name="keywords" content="quantity surveying, BOQ, Nigeria, QS, construction, calculators, invoices" />
        <meta name="author" content="Fudo Greentech Ltd." />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="QSToolkit — Your Quantity Surveying Toolkit" />
        <meta property="og:description" content="Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices & Project Tracking." />
        <meta property="og:url" content="https://qs.solnuv.com" />
        <meta property="og:image" content="https://qs.solnuv.com/icons/icon.svg" />
        <meta property="og:site_name" content="QSToolkit" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="QSToolkit" />
        <meta name="twitter:description" content="Nigeria's Professional Quantity Surveying Platform." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
