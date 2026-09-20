import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { CALCULATORS, CALCULATOR_CATEGORIES } from '../../utils/helpers';

export default function CalculatorsPage() {
  const [search, setSearch] = useState('');

  const filtered = search.length >= 2
    ? CALCULATORS.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase())
      )
    : CALCULATORS;

  const byCategory = CALCULATOR_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter(c => c.category === cat);
    return acc;
  }, {});

  return (
    <ProtectedRoute>
      <Head>
        <title>Calculators | QSToolkit</title>
        <meta name="description" content="70+ quantity surveying calculators for Nigerian construction: concrete, steel, blockwork, formwork, roofing, plumbing & more. BS 4449 standards, local mix ratios." />
        <meta name="keywords" content="QS calculators Nigeria, quantity surveying calculator, concrete calculator, steel calculator, blockwork calculator, formwork calculator" />
        <link rel="canonical" href="https://qs.solnuv.com/calculators" />
      </Head>
      <Layout title="🧮 QS Calculators">
        <div className="max-w-5xl">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search calculators..."
                className="input pl-10"
              />
            </div>
          </div>

          {/* Intro */}
          <div className="mb-6">
            <p className="text-gray-500 text-sm max-w-2xl">
              All <strong>13 calculators</strong> use Nigerian construction standards -- sandcrete block sizes,
              BS 4449 steel weights, BRC mesh to BS 4483, local mix ratios and material units.
              Results can be saved directly to any project.
            </p>
          </div>

          {/* By category */}
          <div className="space-y-8">
            {CALCULATOR_CATEGORIES.map(cat => {
              if (byCategory[cat].length === 0) return null;
              return (
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
                          Open <span>&rarr;</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {search.length >= 2 && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No calculators match &quot;{search}&quot;</p>
            </div>
          )}

          {/* Tip */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            <strong>💡 Pro tip:</strong> Save any calculation to a project, then import the results directly into a BOQ item - no re-typing needed.
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
