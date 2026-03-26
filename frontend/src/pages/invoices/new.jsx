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

export default function NewInvoicePage() {
  const router = useRouter();
  const { project_id } = router.query;

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    project_id: '',
    invoice_type: 'invoice',
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
      await invoiceAPI.create({ ...form, items: cleanItems });
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
                      className="input sm:col-span-6"
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
                      className="input sm:col-span-3"
                      placeholder="Unit price"
                      value={item.unit_price}
                      onChange={(e) => setItem(idx, 'unit_price', e.target.value)}
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
