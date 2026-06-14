import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { CALCULATORS, CALCULATOR_CATEGORIES } from '../../utils/helpers';

export default function CalculatorsPage() {
  const byCategory = CALCULATOR_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = CALCULATORS.filter(c => c.category === cat);
    return acc;
  }, {});

  return (
    <ProtectedRoute>
      <Head>
        <title>70+ QS Calculators — QSToolkit</title>
        <meta name="description" content="70+ quantity surveying calculators for Nigerian construction: concrete, steel, blockwork, formwork, roofing, plumbing & more. BS 4449 standards, local mix ratios." />
        <meta name="keywords" content="QS calculators Nigeria, quantity surveying calculator, concrete calculator, steel calculator, blockwork calculator, formwork calculator" />
        <link rel="canonical" href="https://qs.solnuv.com/calculators" />
      </Head>
      <Layout title="🧮 QS Calculators">
        <div className="max-w-5xl">
          {/* Intro */}
          <div className="mb-6">
            <p className="text-gray-500 text-sm max-w-2xl">
              All <strong>10+ calculators</strong> use Nigerian construction standards — sandcrete block sizes,
              BS 4449 steel weights, BRC mesh to BS 4483, local mix ratios and material units.
              Results can be saved directly to any project.
            </p>
          </div>

          {/* By category */}
          <div className="space-y-8">
            {CALCULATOR_CATEGORIES.map(cat => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="section-title">{cat}</h2>
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400">{byCategory[cat].length} calculators</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {byCategory[cat].map(calc => (
                    <Link
                      key={calc.id}
                      href={`/calculators/${calc.id}`}
                      className="card hover:shadow-card-md hover:border-primary-200 transition-all group cursor-pointer flex flex-col"
                    >
                      <div className="text-3xl mb-3">{calc.icon}</div>
                      <h3 className="font-display font-bold text-primary-800 text-sm group-hover:text-primary-600 mb-1 leading-tight">
                        {calc.label}
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed flex-1">{calc.description}</p>
                      <div className="mt-3 text-xs font-semibold text-primary-600 group-hover:text-primary-700 flex items-center gap-1">
                        Open <span>→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tip */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <strong>💡 Pro tip:</strong> Save any calculation to a project, then import the results directly into a BOQ item — no re-typing needed.
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
