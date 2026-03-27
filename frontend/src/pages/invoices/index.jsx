import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { invoiceAPI } from '../../services/api';
import { formatNaira, formatDate, statusBadge } from '../../utils/helpers';

const TYPE_LABELS = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  valuation: 'Valuation'
};

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const params = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all')   params.type   = typeFilter;

    invoiceAPI.list(params)
      .then((r) => setInvoices(r.data.invoices || []))
      .catch(() => toast.error('Could not load invoices'))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  const STATUS_OPTS = ['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'];
  const TYPE_OPTS   = ['all', 'invoice', 'quotation', 'valuation'];

  return (
    <ProtectedRoute requirePlan="basic">
      <Head><title>Invoices & Quotes — QSToolkit</title></Head>
      <Layout title="🧾 Invoices & Quotes">
        <div className="max-w-5xl space-y-5">

          {/* Filters + action */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="input text-sm py-1.5 px-3"
              >
                {TYPE_OPTS.map((t) => (
                  <option key={t} value={t}>
                    {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input text-sm py-1.5 px-3"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <Link href="/invoices/new" className="btn-primary text-sm">
              + New Invoice
            </Link>
          </div>

          {/* Summary totals */}
          {!loading && invoices.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: formatNaira(invoices.reduce((s, i) => s + (i.total_amount || 0), 0)), color: 'text-primary-700' },
                { label: 'Paid',    value: formatNaira(invoices.filter(i => i.status === 'paid').reduce((s,i) => s + (i.total_amount||0), 0)),    color: 'text-emerald-600' },
                { label: 'Pending', value: formatNaira(invoices.filter(i => i.status === 'sent').reduce((s,i) => s + (i.total_amount||0), 0)),    color: 'text-blue-600' },
                { label: 'Overdue', value: formatNaira(invoices.filter(i => i.status === 'overdue').reduce((s,i) => s + (i.total_amount||0), 0)), color: 'text-red-600' }
              ].map((stat) => (
                <div key={stat.label} className="card py-3 text-center">
                  <p className={`font-bold text-base ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-20 animate-pulse bg-gray-100" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="card text-center py-14">
              <p className="text-4xl mb-3">🧾</p>
              <p className="text-gray-500 text-sm mb-4">
                No invoices or quotes yet.
              </p>
              <Link href="/invoices/new" className="btn-primary text-sm">
                Create First Invoice
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="card flex items-start justify-between gap-4 hover:border-primary-200 hover:shadow-md transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 truncate">
                        {inv.invoice_no || 'Draft Invoice'}
                      </h3>
                      <span className="badge badge-blue capitalize text-xs">
                        {TYPE_LABELS[inv.invoice_type] || inv.invoice_type}
                      </span>
                      <span className={statusBadge(inv.status)}>{inv.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {inv.client_name ? `Client: ${inv.client_name} · ` : ''}
                      {inv.projects?.title ? `Project: ${inv.projects.title} · ` : ''}
                      {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary-700 text-sm">
                      {formatNaira(inv.total_amount)}
                    </p>
                    {inv.due_date && (
                      <p className={`text-xs mt-0.5 ${
                        new Date(inv.due_date) < new Date() && inv.status !== 'paid'
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}>
                        Due {formatDate(inv.due_date)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
