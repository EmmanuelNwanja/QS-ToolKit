import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { invoiceAPI, downloadBlob } from '../../services/api';
import { formatDate, formatNaira } from '../../utils/helpers';

function blankItem() {
  return { description: '', unit: '', quantity: 1, unit_price: 0 };
}

const CURRENCY_OPTS = ['NGN', 'USD', 'GBP', 'EUR'];

function formatMoney(currency, amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    invoice_type: 'invoice',
    currency: 'NGN',
    client_name: '',
    client_email: '',
    due_date: '',
    vat_percent: 7.5,
    discount_percent: 0,
    notes: '',
    status: 'draft'
  });
  const [items, setItems] = useState([blankItem()]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
    const vat = subtotal * (Number(form.vat_percent || 0) / 100);
    const discount = subtotal * (Number(form.discount_percent || 0) / 100);
    const total = subtotal + vat - discount;
    return { subtotal, vat, discount, total };
  }, [items, form.vat_percent, form.discount_percent]);

  const fetchInvoice = async () => {
    if (!id) return;
    try {
      const { data } = await invoiceAPI.get(id);
      const inv = data.invoice;
      setInvoice(inv);
      setForm({
        invoice_type: inv.invoice_type || 'invoice',
        currency: inv.currency || 'NGN',
        client_name: inv.client_name || '',
        client_email: inv.client_email || '',
        due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : '',
        vat_percent: inv.vat_percent ?? 7.5,
        discount_percent: inv.discount_percent ?? 0,
        notes: inv.notes || '',
        status: inv.status || 'draft'
      });
      setItems((inv.invoice_items || []).length > 0 ? inv.invoice_items : [blankItem()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invoice not found');
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setItemField = (index, key, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, blankItem()]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const saveInvoice = async (e) => {
    e.preventDefault();
    const cleanItems = items
      .map((item) => ({
        description: item.description,
        unit: item.unit || null,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0)
      }))
      .filter((item) => item.description && item.quantity > 0);

    if (!form.client_name.trim()) {
      toast.error('Client name is required');
      return;
    }

    if (cleanItems.length === 0) {
      toast.error('Add at least one invoice item');
      return;
    }

    setSaving(true);
    try {
      // Backend schema does not currently persist invoice currency.
      const { currency, ...rest } = form;
      await invoiceAPI.update(id, { ...rest, items: cleanItems });
      await fetchInvoice();
      toast.success('Invoice updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update invoice');
    } finally {
      setSaving(false);
    }
  };

  const sendInvoice = async () => {
    setSending(true);
    try {
      await invoiceAPI.send(id);
      await fetchInvoice();
      toast.success('Invoice sent to client');
    } catch (err) {
      if (err.response?.data?.code === 'PDF_UNAVAILABLE') {
        toast.error('PDF mailer is temporarily unavailable. Please retry sending shortly.');
        return;
      }
      toast.error(err.response?.data?.message || 'Could not send invoice');
    } finally {
      setSending(false);
    }
  };

  const exportPdf = async () => {
    try {
      const res = await invoiceAPI.exportPdf(id);
      downloadBlob(res.data, `${invoice?.invoice_no || 'invoice'}.pdf`);
    } catch (err) {
      if (err.response?.data?.code === 'PDF_UNAVAILABLE') {
        toast.error('PDF export is temporarily unavailable. Please retry shortly.');
        return;
      }
      toast.error(err.response?.data?.message || 'Could not export PDF');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await invoiceAPI.exportExcel(id);
      downloadBlob(res.data, `${invoice?.invoice_no || 'invoice'}.xlsx`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export Excel');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="Invoice">
          <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!invoice) return null;

  return (
    <ProtectedRoute>
      <Head><title>{invoice.invoice_no || 'Invoice'} - QSToolkit</title></Head>
      <Layout title="Invoice Details">
        <div className="max-w-6xl space-y-6">
          <div className="card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="page-title">{invoice.invoice_no || 'Invoice'}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Project: {invoice.projects?.title || 'N/A'} • Created {formatDate(invoice.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportPdf} className="btn-secondary text-sm">Export PDF</button>
                <button onClick={exportExcel} className="btn-secondary text-sm">Export Excel</button>
                <button onClick={sendInvoice} className="btn-primary text-sm" disabled={sending || !form.client_email}>
                  {sending ? 'Sending...' : 'Send to Client'}
                </button>
              </div>
            </div>
          </div>

          <form className="card space-y-5" onSubmit={saveInvoice}>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Currency</label>
                <select className="input" value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                  {CURRENCY_OPTS.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Document Type <span className="text-red-500">*</span></label>
                <select className="input" value={form.invoice_type} onChange={(e) => setField('invoice_type', e.target.value)}>
                  <option value="invoice">Invoice</option>
                  <option value="quotation">Quotation</option>
                  <option value="valuation">Valuation</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Client Name <span className="text-red-500">*</span></label>
                <input className="input" value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} required />
              </div>
              <div>
                <label className="label">Client Email</label>
                <input type="email" className="input" value={form.client_email} onChange={(e) => setField('client_email', e.target.value)} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">VAT %</label>
                <input type="number" min="0" step="0.1" className="input" value={form.vat_percent} onChange={(e) => setField('vat_percent', e.target.value)} />
              </div>
              <div>
                <label className="label">Discount %</label>
                <input type="number" min="0" step="0.1" className="input" value={form.discount_percent} onChange={(e) => setField('discount_percent', e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Items <span className="text-red-500">*</span></label>
                <button type="button" onClick={addItem} className="text-sm font-semibold text-primary-700">+ Add Item</button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="grid sm:grid-cols-12 gap-2 items-center">
                    <input className="input sm:col-span-4" placeholder="Description" value={item.description} onChange={(e) => setItemField(idx, 'description', e.target.value)} />
                    <input className="input sm:col-span-1" placeholder="Unit" value={item.unit || ''} onChange={(e) => setItemField(idx, 'unit', e.target.value)} />
                    <input type="number" min="1" step="0.001" className="input sm:col-span-2" placeholder="Qty" value={item.quantity} onChange={(e) => setItemField(idx, 'quantity', e.target.value)} />
                    <input type="number" min="0" step="0.01" className="input sm:col-span-2" placeholder="Unit Price" value={item.unit_price} onChange={(e) => setItemField(idx, 'unit_price', e.target.value)} />
                    <input className="input sm:col-span-2 bg-gray-50" value={formatMoney(form.currency, Number(item.quantity || 0) * Number(item.unit_price || 0))} readOnly />
                    <button type="button" className="btn-secondary sm:col-span-1" onClick={() => removeItem(idx)} disabled={items.length === 1}>X</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 grid sm:grid-cols-2 gap-2 text-sm">
              <p className="text-gray-600">Subtotal: <span className="font-semibold text-gray-900">{formatMoney(form.currency, totals.subtotal)}</span></p>
              <p className="text-gray-600">VAT: <span className="font-semibold text-gray-900">{formatMoney(form.currency, totals.vat)}</span></p>
              <p className="text-gray-600">Discount: <span className="font-semibold text-gray-900">{formatMoney(form.currency, totals.discount)}</span></p>
              <p className="text-gray-900">Total Amount: <span className="font-bold text-primary-700">{formatMoney(form.currency, totals.total)}</span></p>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Invoice'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
