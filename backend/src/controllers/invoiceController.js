const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const pdfService = require('../services/pdfService');
const excelService = require('../services/excelService');
const emailService = require('../services/emailService');
const { singleOrNull } = require('../utils/supabaseQuery');

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

    if (!Array.isArray(items)) {
      return res.status(400).json(error('Items must be an array', { code: 'INVALID_ITEMS_FORMAT' }));
    }

    for (const item of items) {
      const description = String(item?.description || '').trim();
      const quantity = Number(item?.quantity);
      const unitPrice = Number(item?.unit_price);

      if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
        return res.status(400).json(error('Each item must include a description, quantity > 0, and unit price >= 0', {
          code: 'INVALID_ITEMS_FORMAT'
        }));
      }
    }

    const allowedTypes = ['invoice', 'quotation', 'valuation', 'proforma'];
    const invoiceType = allowedTypes.includes(invoiceData.invoice_type)
      ? invoiceData.invoice_type
      : 'invoice';

    // Auto-generate invoice number
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    const year = new Date().getFullYear();
    const invoiceNo = `QST-${year}-${String((count || 0) + 1).padStart(4, '0')}`;

    let resolvedClientName = (invoiceData.client_name || '').trim();
    if (!resolvedClientName && invoiceData.project_id) {
      const project = await singleOrNull(
        supabase
        .from('projects')
        .select('client_name')
        .eq('id', invoiceData.project_id)
        .eq('user_id', req.user.id)
      );

      resolvedClientName = (project?.client_name || '').trim();
    }

    if (!resolvedClientName) {
      return res.status(400).json(error('Client name is required to create this document', { code: 'CLIENT_NAME_REQUIRED' }));
    }

    // Calculate totals
    const subtotal = items.reduce((s, item) => s + (item.quantity * item.unit_price), 0);
    const vatAmount = subtotal * ((invoiceData.vat_percent || 7.5) / 100);
    const discountAmount = subtotal * ((invoiceData.discount_percent || 0) / 100);
    const total = subtotal + vatAmount - discountAmount;

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        ...invoiceData,
        invoice_type: invoiceType,
        client_name: resolvedClientName,
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
      const { error: itemErr } = await supabase.from('invoice_items').insert(
        items.map((item, i) => ({ ...item, invoice_id: invoice.id, sort_order: i }))
      );

      if (itemErr) throw itemErr;
    }

    const fullInvoice = await getFullInvoice(invoice.id, req.user.id);
    return res.status(201).json(success('Invoice created', { invoice: fullInvoice }));
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));
    return res.json(success('Invoice details', { invoice }));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { items, ...updates } = req.body;

    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return res.status(400).json(error('Items must be an array', { code: 'INVALID_ITEMS_FORMAT' }));
      }

      for (const item of items) {
        const description = String(item?.description || '').trim();
        const quantity = Number(item?.quantity);
        const unitPrice = Number(item?.unit_price);

        if (!description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
          return res.status(400).json(error('Each item must include a description, quantity > 0, and unit price >= 0', {
            code: 'INVALID_ITEMS_FORMAT'
          }));
        }
      }

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
      const { error: itemErr } = await supabase.from('invoice_items').insert(
        items.map((item, i) => ({ ...item, invoice_id: req.params.id, sort_order: i }))
      );

      if (itemErr) throw itemErr;
    }

    const { data, error: err } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (err || !data) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));
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
    if (!invoice) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));

    const branding = await getBrandingForUser(req.user.id);

    const pdfBuffer = await pdfService.generateInvoicePdf(invoice, branding);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    if (pdfService.isPdfUnavailableError?.(err)) {
      return res.status(503).json(error('PDF export is temporarily unavailable. Please retry later.', {
        code: 'PDF_UNAVAILABLE',
        details: err.details || null
      }));
    }
    next(err);
  }
};

exports.exportExcel = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));

    const branding = await getBrandingForUser(req.user.id);

    const buffer = await excelService.generateInvoiceExcel(invoice, branding);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_no}.xlsx"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.sendToClient = async (req, res, next) => {
  try {
    const invoice = await getFullInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));

    const branding = await getBrandingForUser(req.user.id);

    const pdfBuffer = await pdfService.generateInvoicePdf(invoice, branding);
    await emailService.sendInvoiceToClient(invoice, branding, pdfBuffer);

    await supabase.from('invoices').update({ status: 'sent' }).eq('id', req.params.id);
    return res.json(success('Invoice sent to client'));
  } catch (err) {
    if (pdfService.isPdfUnavailableError?.(err)) {
      return res.status(503).json(error('Invoice was created but PDF email delivery is temporarily unavailable. Please retry sending later.', {
        code: 'PDF_UNAVAILABLE',
        details: err.details || null
      }));
    }
    next(err);
  }
};

// ─── Helpers ──────────────────────────────────────────────────
async function getFullInvoice(invoiceId, userId) {
  const invoice = await singleOrNull(
    supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .eq('user_id', userId)
  );

  if (!invoice) return null;

  // Fetch project separately if project_id exists
  if (invoice.project_id) {
    const project = await singleOrNull(
      supabase
        .from('projects')
        .select('id, title')
        .eq('id', invoice.project_id)
    );
    invoice.projects = project ? { title: project.title } : null;
  } else {
    invoice.projects = null;
  }

  return invoice;
}

async function getBrandingForUser(userId) {
  return singleOrNull(
    supabase
    .from('branding_settings')
    .select('*')
    .eq('user_id', userId)
  );
}
