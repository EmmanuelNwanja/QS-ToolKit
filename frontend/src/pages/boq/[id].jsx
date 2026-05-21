import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import ProtectedRoute from '../../components/ProtectedRoute';
import { boqAPI, downloadBlob, integrityAPI, revisionAPI } from '../../services/api';
import { formatNaira, formatDate } from '../../utils/helpers';

function blankItem() {
  return {
    item_no: '',
    description: '',
    unit: '',
    quantity: '1',
    rate: '',
    remarks: '',
    cost_class: 'measured_work',
    material_type: '',
    thickness_or_mix: '',
    finish_type: '',
    spec_reference: ''
  };
}

export default function BoqDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [savingDoc, setSavingDoc] = useState(false);
  const [boq, setBoq] = useState(null);
  const [docForm, setDocForm] = useState({ title: '', notes: '', status: 'draft', measurement_standard: '' });
  const [certifying, setCertifying] = useState(false);
  const [certResult, setCertResult] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [showVariance, setShowVariance] = useState(false);
  const [variance, setVariance] = useState(null);
  const [loadingVariance, setLoadingVariance] = useState(false);

  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionType, setNewSectionType] = useState('measured_work');
  const [addingSection, setAddingSection] = useState(false);

  const [itemForms, setItemForms] = useState({});
  const [addingItem, setAddingItem] = useState({});

  const sections = useMemo(() => {
    return [...(boq?.boq_sections || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [boq]);

  const fetchBoq = async () => {
    if (!id) return;
    try {
      const { data } = await boqAPI.get(id);
      const next = data.boq;
      setBoq(next);
      setDocForm({
        title: next.title || '',
        notes: next.notes || '',
        status: next.status || 'draft',
        measurement_standard: next.measurement_standard || ''
      });
      // Load revisions
      const { data: revData } = await revisionAPI.list(id);
      setRevisions(revData.revisions || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'BOQ not found');
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoq();
  }, [id]);

  const setItemField = (sectionId, key, value) => {
    setItemForms((prev) => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || blankItem()),
        [key]: value
      }
    }));
  };

  const addSection = async (e) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;

    setAddingSection(true);
    try {
      await boqAPI.addSection(id, {
        title: newSectionTitle.trim(),
        sort_order: sections.length,
        section_type: newSectionType
      });
      setNewSectionTitle('');
      setNewSectionType('measured_work');
      await fetchBoq();
      toast.success('Section added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add section');
    } finally {
      setAddingSection(false);
    }
  };

  const addItem = async (sectionId) => {
    const form = itemForms[sectionId] || blankItem();
    if (!form.description?.trim()) {
      toast.error('Item description is required');
      return;
    }

    setAddingItem((prev) => ({ ...prev, [sectionId]: true }));
    try {
      await boqAPI.addItem(id, sectionId, {
        item_no: form.item_no || null,
        description: form.description.trim(),
        unit: form.unit || null,
        // Unpriced BOQ support: blank quantity/rate become 0.
        quantity: Number(form.quantity || 0),
        rate: Number(form.rate || 0),
        remarks: form.remarks || null
        ,
        cost_class: form.cost_class || 'measured_work',
        material_type: form.material_type || null,
        thickness_or_mix: form.thickness_or_mix || null,
        finish_type: form.finish_type || null,
        spec_reference: form.spec_reference || null
      });
      setItemForms((prev) => ({ ...prev, [sectionId]: blankItem() }));
      await fetchBoq();
      toast.success('Item added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add item');
    } finally {
      setAddingItem((prev) => ({ ...prev, [sectionId]: false }));
    }
  };

  const updateItemField = async (sectionId, itemId, patch) => {
    try {
      await boqAPI.updateItem(id, sectionId, itemId, patch);
      await fetchBoq();
      toast.success('Item updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update item');
    }
  };

  const removeItem = async (sectionId, itemId) => {
    try {
      await boqAPI.removeItem(id, sectionId, itemId);
      await fetchBoq();
      toast.success('Item removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove item');
    }
  };

  const saveBoqMeta = async (e) => {
    e.preventDefault();
    setSavingDoc(true);
    try {
      await boqAPI.update(id, docForm);
      await fetchBoq();
      toast.success('BOQ details saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save BOQ');
    } finally {
      setSavingDoc(false);
    }
  };

  const exportPdf = async () => {
    try {
      const res = await boqAPI.exportPdf(id);
      downloadBlob(res.data, `BOQ-${String(boq?.title || 'document').replace(/\s+/g, '-')}.pdf`);
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
      const res = await boqAPI.exportExcel(id);
      downloadBlob(res.data, `BOQ-${String(boq?.title || 'document').replace(/\s+/g, '-')}.xlsx`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export Excel');
    }
  };

  const certifyBoq = async () => {
    setCertifying(true);
    try {
      const { data } = await integrityAPI.certifyBoq(id);
      setCertResult(data);
      toast.success('BOQ certified — tamper-evident hash generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Certification failed');
    } finally {
      setCertifying(false);
    }
  };

  const compareVariance = async (revA, revB) => {
    setLoadingVariance(true);
    try {
      const { data } = await revisionAPI.variance(id, revA, revB);
      setVariance(data);
    } catch (err) {
      toast.error('Could not compare revisions');
    } finally {
      setLoadingVariance(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout title="BOQ">
          <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!boq) return null;

  return (
    <ProtectedRoute>
      <Head><title>{boq.title} - BOQ - QSToolkit</title></Head>
      <Layout title="BOQ Details">
        <div className="max-w-6xl space-y-6">
          <div className="card">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="page-title">{boq.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Project: {boq.projects?.title || 'N/A'} • Created {formatDate(boq.created_at)}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={exportPdf} className="btn-secondary text-sm">Export PDF</button>
                <button onClick={exportExcel} className="btn-secondary text-sm">Export Excel</button>
                <button
                  onClick={certifyBoq}
                  disabled={certifying || boq.status !== 'final' && boq.status !== 'submitted'}
                  className="btn-secondary text-sm disabled:opacity-50"
                  title={boq.status !== 'final' && boq.status !== 'submitted' ? 'Finalize BOQ first' : 'Generate integrity certificate'}
                >
                  {certifying ? 'Certifying...' : '🔐 Certify'}
                </button>
              </div>
            </div>

            {certResult && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs font-semibold text-emerald-800 mb-1">✓ Document Certified</p>
                <p className="text-[10px] text-emerald-700 font-mono break-all">Hash: {certResult.hash}</p>
                <p className="text-[10px] text-emerald-700">Token: {certResult.certToken?.slice(0, 16)}...</p>
              </div>
            )}

            <form className="mt-5 grid sm:grid-cols-3 gap-4" onSubmit={saveBoqMeta}>
              <div className="sm:col-span-2">
                <label className="label">Title <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  value={docForm.title}
                  onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={docForm.status}
                  onChange={(e) => setDocForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="final">Final</option>
                  <option value="submitted">Submitted</option>
                </select>
              </div>
              <div>
                <label className="label">Measurement Standard <span className="text-red-500">*</span></label>
                <select
                  className="input"
                  value={docForm.measurement_standard}
                  onChange={(e) => setDocForm((f) => ({ ...f, measurement_standard: e.target.value }))}
                  required
                >
                  <option value="">Select standard...</option>
                  <option value="SMM7">SMM7</option>
                  <option value="NRM2">NRM2</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={docForm.notes || ''}
                  onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button type="submit" className="btn-primary" disabled={savingDoc}>
                  {savingDoc ? 'Saving...' : 'Save BOQ Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Variance Detection */}
          {revisions.length >= 2 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">📊 Variance Detection</h3>
                <button
                  onClick={() => setShowVariance((s) => !s)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {showVariance ? 'Hide' : 'Compare Revisions'}
                </button>
              </div>
              {showVariance && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      className="input text-sm"
                      onChange={(e) => {
                        const revA = e.target.value;
                        const revB = revisions[revisions.length - 1]?.id;
                        if (revA && revB) compareVariance(revA, revB);
                      }}
                    >
                      <option value="">Select older revision...</option>
                      {revisions.slice(0, -1).map((r) => (
                        <option key={r.id} value={r.id}>Rev {r.revision_number} — {formatDate(r.created_at)}</option>
                      ))}
                    </select>
                  </div>
                  {loadingVariance && <p className="text-sm text-gray-500">Analyzing changes...</p>}
                  {variance && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <span className="text-gray-500">Old Total</span>
                          <p className="font-semibold">{formatNaira(variance.diff?.summary?.old_total)}</p>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <span className="text-gray-500">New Total</span>
                          <p className="font-semibold">{formatNaira(variance.diff?.summary?.new_total)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">+{variance.diff?.summary?.items_added} added</span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">-{variance.diff?.summary?.items_removed} removed</span>
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">~{variance.diff?.summary?.items_modified} modified</span>
                      </div>
                      {variance.ai_summary && (
                        <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-800">
                          <span className="font-semibold">AI Summary:</span> {variance.ai_summary.summary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="section-title">Sections & Items</h2>
              <span className="text-sm font-semibold text-primary-700">Total: {formatNaira(boq.total_amount || 0)}</span>
            </div>

            <form onSubmit={addSection} className="grid sm:grid-cols-6 gap-2 mb-5">
              <input
                className="input sm:col-span-3"
                placeholder="Add section title (e.g. Preliminaries)"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                required
              />
              <select className="input sm:col-span-2" value={newSectionType} onChange={(e) => setNewSectionType(e.target.value)}>
                <option value="measured_work">Measured Work</option>
                <option value="preliminaries">Preliminaries</option>
                <option value="provisional_sum">Provisional Sum</option>
                <option value="dayworks">Dayworks</option>
              </select>
              <button type="submit" className="btn-secondary" disabled={addingSection}>
                {addingSection ? 'Adding...' : 'Add Section'}
              </button>
            </form>

            {sections.length === 0 ? (
              <p className="text-sm text-gray-500">No sections yet. Add your first section above.</p>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => {
                  const sortedItems = [...(section.boq_items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                  const form = itemForms[section.id] || blankItem();

                  return (
                    <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">{section.title}</h3>
                        <span className="text-xs text-gray-500 uppercase">{section.section_type || 'measured_work'}</span>
                        <span className="text-sm text-gray-600">Section total: {formatNaira(section.section_total || 0)}</span>
                      </div>

                      <div className="overflow-x-auto mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 border-b">
                              <th className="py-2 pr-3">Item No</th>
                              <th className="py-2 pr-3">Description</th>
                              <th className="py-2 pr-3">Spec</th>
                              <th className="py-2 pr-3">Unit</th>
                              <th className="py-2 pr-3">Qty</th>
                              <th className="py-2 pr-3">Rate</th>
                              <th className="py-2 pr-3">Amount</th>
                              <th className="py-2 pr-3">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedItems.map((item) => (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 text-gray-700">{item.item_no || '-'}</td>
                                <td className="py-2 pr-3 text-gray-700">{item.description}</td>
                                <td className="py-2 pr-3 text-xs text-gray-600">
                                  {[item.material_type, item.thickness_or_mix, item.finish_type].filter(Boolean).join(' | ') || '-'}
                                </td>
                                <td className="py-2 pr-3 text-gray-700">{item.unit || '-'}</td>
                                <td className="py-2 pr-3 w-24">
                                  <input
                                    type="number"
                                    step="0.001"
                                    className="input py-1"
                                    defaultValue={item.quantity || 0}
                                    onBlur={(e) => updateItemField(section.id, item.id, { quantity: Number(e.target.value || 0) })}
                                  />
                                </td>
                                <td className="py-2 pr-3 w-32">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="input py-1"
                                    defaultValue={item.rate || 0}
                                    onBlur={(e) => updateItemField(section.id, item.id, { rate: Number(e.target.value || 0) })}
                                  />
                                </td>
                                <td className="py-2 pr-3 text-gray-900 font-medium">{formatNaira(item.amount || 0)}</td>
                                <td className="py-2 pr-3">
                                  <button
                                    className="text-xs text-red-600 hover:underline"
                                    onClick={() => removeItem(section.id, item.id)}
                                    type="button"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid sm:grid-cols-12 gap-2 items-center">
                        <input className="input sm:col-span-1" placeholder="No" value={form.item_no} onChange={(e) => setItemField(section.id, 'item_no', e.target.value)} />
                        <input className="input sm:col-span-3" placeholder="Description" value={form.description} onChange={(e) => setItemField(section.id, 'description', e.target.value)} />
                        <input className="input sm:col-span-1" placeholder="Unit" value={form.unit} onChange={(e) => setItemField(section.id, 'unit', e.target.value)} />
                        <input type="number" step="0.001" className="input sm:col-span-2" placeholder="Qty" value={form.quantity} onChange={(e) => setItemField(section.id, 'quantity', e.target.value)} />
                        <input type="number" step="0.01" className="input sm:col-span-2" placeholder="Rate (optional)" value={form.rate} onChange={(e) => setItemField(section.id, 'rate', e.target.value)} />
                        <input className="input sm:col-span-1 bg-gray-50" placeholder="Amount" value={Number(form.quantity || 0) * Number(form.rate || 0)} readOnly />
                        <button
                          type="button"
                          onClick={() => addItem(section.id)}
                          className="btn-secondary sm:col-span-2"
                          disabled={addingItem[section.id]}
                        >
                          {addingItem[section.id] ? 'Adding...' : 'Add Item'}
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-12 gap-2 mt-2">
                        <select className="input sm:col-span-2" value={form.cost_class} onChange={(e) => setItemField(section.id, 'cost_class', e.target.value)}>
                          <option value="measured_work">Measured Work</option>
                          <option value="preliminaries">Preliminaries</option>
                          <option value="provisional_sum">Provisional Sum</option>
                          <option value="dayworks">Dayworks</option>
                        </select>
                        <input className="input sm:col-span-3" placeholder="Material Type" value={form.material_type} onChange={(e) => setItemField(section.id, 'material_type', e.target.value)} />
                        <input className="input sm:col-span-2" placeholder="Thickness/Mix" value={form.thickness_or_mix} onChange={(e) => setItemField(section.id, 'thickness_or_mix', e.target.value)} />
                        <input className="input sm:col-span-2" placeholder="Finish Type" value={form.finish_type} onChange={(e) => setItemField(section.id, 'finish_type', e.target.value)} />
                        <input className="input sm:col-span-3" placeholder="Spec Reference" value={form.spec_reference} onChange={(e) => setItemField(section.id, 'spec_reference', e.target.value)} />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Leave rate empty for unpriced BOQ lines. Amount auto-calculates as quantity × rate.</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
