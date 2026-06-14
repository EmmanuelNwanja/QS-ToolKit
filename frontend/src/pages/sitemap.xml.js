const SITE_URL = 'https://qs.solnuv.com';

const STATIC_PAGES = [
  { url: '/',              changefreq: 'weekly',  priority: '1.0' },
  { url: '/pricing',       changefreq: 'monthly', priority: '0.9' },
  { url: '/auth/login',    changefreq: 'monthly', priority: '0.5' },
  { url: '/auth/register', changefreq: 'monthly', priority: '0.7' },
  { url: '/calculators',   changefreq: 'weekly',  priority: '0.9' },
];

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static pages
  for (const page of STATIC_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>${SITE_URL}${page.url}</loc>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Dynamic calculator pages (70 QS calculators)
  try {
    const calcSlugs = [
      'concrete', 'blockwork', 'formwork', 'steel', 'roofing',
      'plastering', 'painting', 'tiling', 'flooring', 'ceiling',
      'doors', 'windows', 'plumbing', 'electrical', 'hvac',
      'excavation', 'backfill', 'drainage', 'external-works', 'landscaping',
      'piling', 'waterproofing', 'insulation', 'cladding', 'partitioning',
      'joinery', 'ironmongery', 'glazing', 'scaffolding', 'demolition',
      'asphalt', 'kerb', 'pavement', 'retaining-wall', 'manhole',
      'septic-tank', 'borehole', 'water-tank', 'generator', 'solar',
      'fire-fighting', 'fire-detection', 'security', 'cctv', 'access-control',
      'lift', 'escalator', 'swimming-pool', 'turfing', 'irrigation',
      'gate', 'fence', 'wall', 'site-clearance', 'topsoil',
      'aggregate', 'binding-agent', 'bitumen', 'geotextile', 'reinforcement',
      'precast', 'prestressed', 'composite', 'mechanical', 'civil',
      'structural', 'architectural', 'bill-of-quantities', 'rate-analysis', 'cost-estimation',
    ];
    for (const slug of calcSlugs) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/calculators/${slug}</loc>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }
  } catch (e) { /* continue */ }

  // Dynamic project pages (if public — skip for now since projects are private)

  xml += `</urlset>`;

  res.write(xml);
  res.end();

  return { props: {} };
}

export default function Sitemap() { return null; }
