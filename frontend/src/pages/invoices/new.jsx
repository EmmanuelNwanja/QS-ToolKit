import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { invoiceAPI, projectAPI } from '../../services/api';

function emptyItem() {
  return { description: '', quantity: 1, unit_price: 0 };
}

const CURRENCY_OPTS = ['NGN', 'USD', 'GBP', 'EUR'];

function formatMoney(currency, amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { project_id } = router.query;

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    project_id: '',
    invoice_type: 'invoice',
    currency: 'NGN',
    client_name: '',
    client_email: '',
    due_date: '',
    notes: '',
    vat_percent: 7.5,
    discount_percent: 0,
    status: 'draft'
  });
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    projectAPI.list({ limit: 100 })
      .then(({ data }) => setProjects(data.projects || []))
      .catch(() => toast.error('Could not load projects'));
  }, []);

  useEffect(() => {
    if (!project_id) return;
    setForm((f) => ({ ...f, project_id: String(project_id) }));
  }, [project_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setItem = (index, key, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);
  const vatAmount = subtotal * (Number(form.vat_percent || 0) / 100);
  const discountAmount = subtotal * (Number(form.discount_percent || 0) / 100);
  const totalAmount = subtotal + vatAmount - discountAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanItems = items
      .map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }))
      .filter((item) => item.description && item.quantity > 0);

    if (!form.project_id) {
      toast.error('Select a project');
      return;
    }

    if (cleanItems.length === 0) {
      toast.error('Add at least one invoice item');
      return;
    }

    setLoading(true);
    try {
      // Backend schema does not currently persist invoice currency.
      const { currency, ...rest } = form;
      await invoiceAPI.create({ ...rest, items: cleanItems });
      toast.success('Invoice created successfully');
      router.push(`/projects/${form.project_id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head><title>New Invoice - QSToolkit</title></Head>
      <Layout title="New Invoice">
        <div className="max-w-3xl">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <h2 className="section-title">Create Invoice or Quotation</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Project <span className="text-red-500">*</span></label>
                <select className="input" value={form.project_id} onChange={(e) => set('project_id', e.target.value)} required>
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Document Type <span className="text-red-500">*</span></label>
                <select className="input" value={form.invoice_type} onChange={(e) => set('invoice_type', e.target.value)}>
                  <option value="invoice">Invoice</option>
                  <option value="quotation">Quotation</option>
                  <option value="valuation">Valuation</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Client Name</label>
                <input className="input" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Client Email</label>
                <input type="email" className="input" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCY_OPTS.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
              </div>
              <div>
                <label className="label">VAT %</label>
                <input type="number" step="0.1" min="0" className="input" value={form.vat_percent} onChange={(e) => set('vat_percent', e.target.value)} />
              </div>
              <div>
                <label className="label">Discount %</label>
                <input type="number" step="0.1" min="0" className="input" value={form.discount_percent} onChange={(e) => set('discount_percent', e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Items <span className="text-red-500">*</span></label>
                <button type="button" onClick={addItem} className="text-sm text-primary-700 font-semibold">+ Add Item</button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="grid sm:grid-cols-12 gap-2 items-center">
                    <input
                      className="input sm:col-span-4"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => setItem(idx, 'description', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      className="input sm:col-span-2"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      className="input sm:col-span-2"
                      placeholder="Unit price"
                      value={item.unit_price}
                      onChange={(e) => setItem(idx, 'unit_price', e.target.value)}
                    />
                    <input
                      className="input sm:col-span-3 bg-gray-50"
                      value={formatMoney(form.currency, Number(item.quantity || 0) * Number(item.unit_price || 0))}
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="btn-secondary sm:col-span-1"
                      disabled={items.length === 1}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 grid sm:grid-cols-2 gap-2 text-sm">
              <p className="text-gray-600">Subtotal: <span className="font-semibold text-gray-900">{formatMoney(form.currency, subtotal)}</span></p>
              <p className="text-gray-600">VAT: <span className="font-semibold text-gray-900">{formatMoney(form.currency, vatAmount)}</span></p>
              <p className="text-gray-600">Discount: <span className="font-semibold text-gray-900">{formatMoney(form.currency, discountAmount)}</span></p>
              <p className="text-gray-900">Total Amount: <span className="font-bold text-primary-700">{formatMoney(form.currency, totalAmount)}</span></p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Creating...' : 'Create Document'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
