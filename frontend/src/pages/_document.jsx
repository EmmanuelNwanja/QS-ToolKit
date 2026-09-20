import { Html, Head, Main, NextScript } from 'next/document';

const SITE_URL = 'https://qs.solnuv.com';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon (real logo mark on brand navy) */}
        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme & mobile */}
        <meta name="theme-color" content="#1a3c5e" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Viewport: without width=device-width mobile browsers render at ~980px
            and scale down - the root cause of tiny text and side-scrolling. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="QSToolkit" />

        {/* SEO - global fallback (per-page Head overrides these) */}
        <meta name="description" content="QSToolkit - Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices, Project Tracking & AI-powered Dr. Q assistant for quantity surveyors." />
        <meta name="keywords" content="quantity surveying, BOQ, bill of quantities, Nigeria, QS, construction, calculators, invoices, valuations, quotations, project tracking, Dr. Q, AI quantity surveying" />
        <meta name="author" content="Fudo Greentech Ltd." />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="QSToolkit - Your Quantity Surveying Toolkit" />
        <meta property="og:description" content="Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices & Project Tracking. Start free." />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:alt" content="QSToolkit - Nigeria's Quantity Surveying Platform" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="QSToolkit" />
        <meta property="og:locale" content="en_NG" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="QSToolkit - Your Quantity Surveying Toolkit" />
        <meta name="twitter:description" content="Nigeria's Professional Quantity Surveying Platform. BOQs, Calculators, Invoices & Project Tracking." />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'QSToolkit',
              url: SITE_URL,
              logo: `${SITE_URL}/icons/icon-512.png`,
              description: "Nigeria's Professional Quantity Surveying Platform",
              foundingDate: '2024',
              address: {
                '@type': 'PostalAddress',
                addressCountry: 'NG',
              },
              sameAs: [],
            }),
          }}
        />

        {/* Website structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'QSToolkit',
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${SITE_URL}/calculators?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />

        {/* SoftwareApplication structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'QSToolkit',
              operatingSystem: 'Web',
              applicationCategory: 'BusinessApplication',
              url: SITE_URL,
              description: "Nigeria's Professional Quantity Surveying Platform with BOQs, 70+ QS Calculators, Invoices, Project Tracking, and AI-powered Dr. Q assistant.",
              offers: [
                {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'NGN',
                  name: 'Free Plan',
                },
                {
                  '@type': 'Offer',
                  price: '8999',
                  priceCurrency: 'NGN',
                  name: 'Starter Plan',
                },
                {
                  '@type': 'Offer',
                  price: '23999',
                  priceCurrency: 'NGN',
                  name: 'Pro Plan',
                },
                {
                  '@type': 'Offer',
                  price: '84999',
                  priceCurrency: 'NGN',
                  name: 'Elite Plan',
                },
              ],
              author: {
                '@type': 'Organization',
                name: 'Fudo Greentech Ltd.',
              },
            }),
          }}
        />

        {/* LocalBusiness structured data for Nigerian market */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ProfessionalService',
              name: 'QSToolkit',
              url: SITE_URL,
              description: "Professional quantity surveying platform for Nigerian QS professionals. BOQs, calculators, invoices, project tracking.",
              serviceType: 'Quantity Surveying Software',
              areaServed: {
                '@type': 'Country',
                name: 'Nigeria',
              },
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'QS Tools',
                itemListElement: [
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Bill of Quantities (BOQ) Generator',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: '70+ Quantity Surveying Calculators',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Invoice & Quotation Generator',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: 'Project Tracking & Management',
                    },
                  },
                ],
              },
            }),
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
