const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');
const emailService = require('../services/emailService');

exports.list = async (req, res, next) => {
  try {
    const { status, type } = req.query;
    let query = supabase
      .from('invoices')
      .select('*, projects(title)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type)   query = query.eq('invoice_type', type);

    const { data, error: err } = await query;
    if (err) throw err;
    return res.json(success('Invoices retrieved', { invoices: data }));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { items = [], ...invoiceData } = req.body;

    // Auto-generate invoice number
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    const year = new Date().getFullYear();
    const invoiceNo = `QST-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Calculate totals
    const subtotal = items.reduce((s, item) => s + (item.quantity * item.unit_price), 0);
    const vatAmount = subtotal * ((invoiceData.vat_percent || 7.5) / 100);
    const discountAmount = subtotal * ((invoiceData.discount_percent || 0) / 100);
    const total = subtotal + vatAmount - discountAmount;

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        user_id: req.user.id,
        invoice_no: invoiceNo,
        subtotal,
        vat_amount: vatAmount,
        discount_amount: discountAmount,
        total_amount: total
      })
      .select()
      .single();

    if (invErr) throw invErr;

    if (items.length > 0) {
      await supabase.from('invoice_items').insert(
        items.map((item, i) => ({ ...item, invoice_id: invoice.id, sort_order: i }))
      );
    }

    const fullInvoice = await getFullInvoice(invoice.id, req.user.id);
    return res.status(201).json(success('Invoice created', { invoice: fullInvoice }));
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found'));
    return res.json(success('Invoice details', { invoice }));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { items, ...updates } = req.body;

    if (items) {
      // Recalculate totals
      const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
      const vatAmount = subtotal * ((updates.vat_percent || 7.5) / 100);
      const discountAmount = subtotal * ((updates.discount_percent || 0) / 100);
      updates.subtotal = subtotal;
      updates.vat_amount = vatAmount;
      updates.discount_amount = discountAmount;
      updates.total_amount = subtotal + vatAmount - discountAmount;

      // Replace items
      await supabase.from('invoice_items').delete().eq('invoice_id', req.params.id);
      await supabase.from('invoice_items').insert(
        items.map((item, i) => ({ ...item, invoice_id: req.params.id, sort_order: i }))
      );
    }

    const { data, error: err } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (err || !data) return res.status(404).json(error('Invoice not found'));
    return res.json(success('Invoice updated', { invoice: data }));
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await supabase.from('invoices').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    return res.json(success('Invoice deleted'));
  } catch (err) { next(err); }
};

exports.exportPdf = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found'));

    const { data: branding } = await supabase
      .from('branding_settings').select('*').eq('user_id', req.user.id).single();

    const pdfBuffer = await pdfService.generateInvoicePdf(invoice, branding);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found'));

    const { data: branding } = await supabase
      .from('branding_settings').select('*').eq('user_id', req.user.id).single();

    const buffer = await excelService.generateInvoiceExcel(invoice, branding);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.sendToClient = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found'));

    const { data: branding } = await supabase
      .from('branding_settings').select('*').eq('user_id', req.user.id).single();

    const pdfBuffer = await pdfService.generateInvoicePdf(invoice, branding);
    await emailService.sendInvoiceToClient(invoice, branding, pdfBuffer);

    await supabase.from('invoices').update({ status: 'sent' }).eq('id', req.params.id);
    return res.json(success('Invoice sent to client'));
  } catch (err) { next(err); }
};

// ─── Helpers ──────────────────────────────────────────────────
async function getFullInvoice(invoiceId, userId) {
  const { data } = await supabase
    .from('invoices')
    .select('*, invoice_items(*), projects(title)')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();
  return data;
}
