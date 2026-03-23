import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#1a3c5e" />
        <meta name="description" content="QSToolkit — Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices & Project Tracking." />
        <meta property="og:title" content="QSToolkit" />
        <meta property="og:description" content="Nigeria's Quantity Surveying Platform" />
        <meta property="og:url" content="https://qstoolkit.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
