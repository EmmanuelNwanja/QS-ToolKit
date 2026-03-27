/**
 * PDF Service — QSToolkit
 * Uses Puppeteer where available.
 * Falls back to lightweight PDFKit generation when browser runtime is unavailable.
 */

const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');

let puppeteerCore;
let puppeteerFull;
try { puppeteerCore = require('puppeteer-core'); } catch (e) { puppeteerCore = null; }
try { puppeteerFull = require('puppeteer'); } catch (e) { puppeteerFull = null; }

function pdfUnavailableError(message, details = {}) {
  const err = new Error(message);
  err.code = 'PDF_UNAVAILABLE';
  err.details = details;
  return err;
}

function resolveExecutableCandidates() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ].filter(Boolean);
  return [...new Set(candidates)];
}

async function launchWithCandidates(engine, baseOptions, candidates) {
  let launchError = null;

  for (const executablePath of candidates) {
    try {
      return await engine.launch({ ...baseOptions, executablePath });
    } catch (err) {
      launchError = err;
    }
  }

  try {
    return await engine.launch(baseOptions);
  } catch (err) {
    launchError = err;
  }

  throw launchError || new Error('Unable to start browser runtime');
}

const formatNaira = (amount) =>
  `₦${Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', {
  day: '2-digit', month: 'long', year: 'numeric'
}) : '';

// ─── Generate BOQ PDF ─────────────────────────────────────────
exports.generateBoqPdf = async (boq, branding) => {
  const html = buildBoqHtml(boq, branding);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    logger.warn({
      message: 'HTML PDF render failed for BOQ. Falling back to PDFKit.',
      code: err?.code,
      reason: err?.details?.reason || err?.message || null,
      boq_id: boq?.id
    });
    return buildBoqFallbackPdf(boq, branding);
  }
};

// ─── Generate Invoice PDF ─────────────────────────────────────
exports.generateInvoicePdf = async (invoice, branding) => {
  const html = buildInvoiceHtml(invoice, branding);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    logger.warn({
      message: 'HTML PDF render failed for invoice. Falling back to PDFKit.',
      code: err?.code,
      reason: err?.details?.reason || err?.message || null,
      invoice_id: invoice?.id
    });
    return buildInvoiceFallbackPdf(invoice, branding);
  }
};

// ─── HTML → PDF ───────────────────────────────────────────────
async function htmlToPdf(html) {
  if (!puppeteerCore && !puppeteerFull) {
    throw pdfUnavailableError('PDF generation runtime is not installed.');
  }

  const launchOptions = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: 'new'
  };

  const candidates = resolveExecutableCandidates();
  const launchers = [
    { engine: puppeteerFull, candidates: [] },
    { engine: puppeteerCore, candidates }
  ].filter((entry) => !!entry.engine);

  let browser = null;
  let launchError = null;

  for (const launcher of launchers) {
    try {
      try {
        browser = await launchWithCandidates(launcher.engine, launchOptions, launcher.candidates);
      } catch {
        // Older runtime combinations may fail with "headless: new"; retry with classic headless mode.
        browser = await launchWithCandidates(
          launcher.engine,
          { ...launchOptions, headless: true },
          launcher.candidates
        );
      }
      break;
    } catch (err) {
      launchError = err;
    }
  }

  if (!browser) {
    throw pdfUnavailableError('PDF service is temporarily unavailable. Try again later.', {
      reason: launchError?.message || 'Unable to start browser runtime'
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

exports.isPdfUnavailableError = (err) => err?.code === 'PDF_UNAVAILABLE';

function safeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function bufferFromPdfKit(drawFn) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      drawFn(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function buildInvoiceFallbackPdf(invoice, branding) {
  const docTypeLabel = invoice.invoice_type === 'quotation' ? 'QUOTATION'
    : invoice.invoice_type === 'valuation' ? 'VALUATION'
    : invoice.invoice_type === 'proforma' ? 'PROFORMA INVOICE'
    : 'INVOICE';

  return bufferFromPdfKit((doc) => {
    doc.fontSize(18).text(safeText(branding?.brand_name, 'QSToolkit User'));
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(safeText(branding?.contact_info, ''));
    doc.fillColor('#000');
    doc.moveDown(1);

    doc.fontSize(16).text(docTypeLabel, { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`No: ${safeText(invoice.invoice_no)}`, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.issue_date || invoice.created_at)}`, { align: 'right' });

    doc.moveDown(1);
    doc.fontSize(11).text(`Client: ${safeText(invoice.client_name)}`);
    doc.text(`Project: ${safeText(invoice.projects?.title || invoice.project_title, 'N/A')}`);
    doc.text(`Status: ${safeText(invoice.status, 'draft')}`);

    doc.moveDown(1);
    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.4);

    const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
    if (items.length === 0) {
      doc.fontSize(10).text('No line items provided.');
    } else {
      items.forEach((item, index) => {
        const qty = Number(item.quantity || 0);
        const rate = Number(item.unit_price || 0);
        const amount = Number(item.amount ?? qty * rate);
        doc.fontSize(10).text(
          `${index + 1}. ${safeText(item.description)}  |  Qty: ${qty.toFixed(2)}  |  Rate: ${formatNaira(rate)}  |  Amount: ${formatNaira(amount)}`
        );
      });
    }

    doc.moveDown(1);
    doc.fontSize(11).text(`Subtotal: ${formatNaira(invoice.subtotal)}`, { align: 'right' });
    doc.text(`VAT: ${formatNaira(invoice.vat_amount)}`, { align: 'right' });
    doc.fontSize(12).text(`Total: ${formatNaira(invoice.total_amount)}`, { align: 'right' });
  });
}

function buildBoqFallbackPdf(boq, branding) {
  return bufferFromPdfKit((doc) => {
    doc.fontSize(18).text(safeText(branding?.brand_name, 'QSToolkit User'));
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#555').text(safeText(branding?.contact_info, ''));
    doc.fillColor('#000');
    doc.moveDown(1);

    doc.fontSize(16).text('BILL OF QUANTITIES', { align: 'right' });
    doc.moveDown(0.6);
    doc.fontSize(11).text(`Title: ${safeText(boq.title)}`);
    doc.text(`Client: ${safeText(boq.client_name)}`);
    doc.text(`Project: ${safeText(boq.projects?.title, 'N/A')}`);
    doc.text(`Status: ${safeText(boq.status, 'draft')}`);
    doc.moveDown(1);

    const sections = Array.isArray(boq.boq_sections) ? boq.boq_sections : [];
    if (sections.length === 0) {
      doc.fontSize(10).text('No BOQ sections provided.');
    } else {
      sections.forEach((section, sectionIndex) => {
        const letter = String.fromCharCode(65 + sectionIndex);
        doc.fontSize(12).text(`${letter}. ${safeText(section.title)}`, { underline: true });
        const items = Array.isArray(section.boq_items) ? section.boq_items : [];
        if (items.length === 0) {
          doc.fontSize(10).text('No items in this section.');
        } else {
          items.forEach((item, itemIndex) => {
            const qty = Number(item.quantity || 0);
            const rate = Number(item.rate || 0);
            const amount = Number(item.amount ?? qty * rate);
            doc.fontSize(10).text(
              `${letter}${itemIndex + 1} ${safeText(item.description)}  |  ${qty.toFixed(2)} ${safeText(item.unit, '')}  |  ${formatNaira(rate)}  |  ${formatNaira(amount)}`
            );
          });
        }
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(1);
    doc.fontSize(12).text(`Grand Total: ${formatNaira(boq.total_amount)}`, { align: 'right' });
  });
}

// ─── BOQ HTML Template ────────────────────────────────────────
function buildBoqHtml(boq, branding) {
  const primaryColor = branding?.primary_color || '#1a3c5e';
  const secondaryColor = branding?.secondary_color || '#f59e0b';
  const companyName = branding?.brand_name || 'QSToolkit User';

  const sectionsHtml = (boq.boq_sections || []).map((section, si) => `
    <tr class="section-header">
      <td colspan="6">${String.fromCharCode(65 + si)}. ${section.title}</td>
    </tr>
    ${(section.boq_items || []).map((item, ii) => `
      <tr class="${ii % 2 === 0 ? 'even' : ''}">
        <td>${item.item_no || `${String.fromCharCode(65 + si)}${ii + 1}`}</td>
        <td>${item.description}</td>
        <td class="center">${item.unit || '-'}</td>
        <td class="right">${Number(item.quantity || 0).toFixed(2)}</td>
        <td class="right">${formatNaira(item.rate)}</td>
        <td class="right">${formatNaira(item.amount)}</td>
      </tr>
    `).join('')}
    <tr class="subtotal-row">
      <td colspan="5">Sub-total carried to Summary — ${section.title}</td>
      <td class="right">${formatNaira(section.section_total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #222; }
  .header { padding: 16px 0 24px; border-bottom: 3px solid ${primaryColor}; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { max-height: 60px; max-width: 200px; object-fit: contain; }
  .company-info { text-align: right; }
  .company-name { font-size: 18pt; font-weight: bold; color: ${primaryColor}; }
  .doc-title { text-align: center; margin: 20px 0 8px; font-size: 14pt; font-weight: bold; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 2px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; font-size: 9pt; }
  .meta-item label { font-weight: bold; color: ${primaryColor}; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 9pt; }
  th { background: ${primaryColor}; color: white; padding: 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr.even td { background: #f9fafb; }
  .section-header td { background: ${secondaryColor}20; color: ${primaryColor}; font-weight: bold; padding: 8px; }
  .subtotal-row td { font-weight: bold; border-top: 1px solid ${primaryColor}; background: #f1f5f9; }
  .grand-total td { background: ${primaryColor}; color: white; font-weight: bold; font-size: 11pt; padding: 10px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .signature-section { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-box { border-top: 1px solid #333; padding-top: 8px; font-size: 9pt; }
  .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${branding?.logo_url ? `<img src="${branding.logo_url}" class="logo" alt="Logo">` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">${companyName}</div>
      ${branding?.contact_info ? `<div style="font-size:9pt;color:#64748b;margin-top:4px;">${branding.contact_info}</div>` : ''}
    </div>
  </div>

  <div class="doc-title">Bill of Quantities</div>
  <div style="text-align:center;font-size:9pt;color:#64748b;margin-bottom:16px;">
    Document No: ${boq.contract_no || 'N/A'} &nbsp;|&nbsp; Date: ${formatDate(boq.date_prepared)}
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Project Title:</label> ${boq.projects?.title || boq.title}</div>
    <div class="meta-item"><label>Client:</label> ${boq.client_name || boq.projects?.client_name || '-'}</div>
    <div class="meta-item"><label>Location:</label> ${boq.location || boq.projects?.location || '-'}</div>
    <div class="meta-item"><label>Prepared By:</label> ${boq.prepared_by || companyName}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:8%">Item No.</th>
        <th>Description of Work</th>
        <th style="width:8%" class="center">Unit</th>
        <th style="width:10%" class="right">Qty</th>
        <th style="width:14%" class="right">Rate (₦)</th>
        <th style="width:14%" class="right">Amount (₦)</th>
      </tr>
    </thead>
    <tbody>
      ${sectionsHtml}
      <tr class="grand-total">
        <td colspan="5">GRAND TOTAL</td>
        <td class="right">${formatNaira(boq.total_amount)}</td>
      </tr>
    </tbody>
  </table>

  ${boq.notes ? `<div style="margin-top:16px;padding:12px;background:#fffbeb;border-left:4px solid ${secondaryColor};font-size:9pt;"><strong>Notes:</strong> ${boq.notes}</div>` : ''}

  <div class="signature-section">
    <div class="sig-box">
      <strong>Prepared By:</strong> ${boq.prepared_by || companyName}<br>
      ${branding?.signature_url ? `<img src="${branding.signature_url}" style="max-height:50px;margin:8px 0;">` : '<br><br>'}
      Date: _______________
    </div>
    <div class="sig-box">
      <strong>Checked By:</strong> ${boq.checked_by || '________________'}<br><br><br>
      Date: _______________
    </div>
  </div>

  <div class="footer">Generated by QSToolkit · qstoolkit.com · Nigeria's Quantity Surveying Platform</div>
</body>
</html>`;
}

// ─── Invoice HTML Template ────────────────────────────────────
function buildInvoiceHtml(invoice, branding) {
  const primaryColor = branding?.primary_color || '#1a3c5e';
  const secondaryColor = branding?.secondary_color || '#f59e0b';
  const companyName = branding?.brand_name || 'QSToolkit User';
  const docTypeLabel = invoice.invoice_type === 'quotation' ? 'QUOTATION'
    : invoice.invoice_type === 'valuation' ? 'VALUATION'
    : invoice.invoice_type === 'proforma' ? 'PROFORMA INVOICE'
    : 'INVOICE';

  const itemsHtml = (invoice.invoice_items || []).map((item, i) => `
    <tr class="${i % 2 === 0 ? 'even' : ''}">
      <td>${i + 1}</td>
      <td>${item.description}</td>
      <td class="center">${item.unit || '-'}</td>
      <td class="right">${Number(item.quantity || 1).toFixed(2)}</td>
      <td class="right">${formatNaira(item.unit_price)}</td>
      <td class="right">${formatNaira(item.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid ${primaryColor}; }
  .doc-badge { background: ${primaryColor}; color: white; padding: 6px 20px; border-radius: 4px; font-size: 16pt; font-weight: bold; letter-spacing: 3px; }
  .company-name { font-size: 20pt; font-weight: bold; color: ${primaryColor}; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 20px 0; }
  .info-box h4 { color: ${primaryColor}; margin-bottom: 8px; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; }
  .info-box p { font-size: 9pt; line-height: 1.6; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 9pt; }
  th { background: ${primaryColor}; color: white; padding: 10px 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
  tr.even td { background: #f9fafb; }
  .totals { margin-top: 8px; margin-left: auto; width: 280px; }
  .totals table { margin-top: 0; }
  .totals td { border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
  .totals .grand td { background: ${primaryColor}; color: white; font-weight: bold; font-size: 11pt; }
  .center { text-align: center; }
  .right { text-align: right; }
  .badge-status { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 8pt; font-weight: bold; background: ${secondaryColor}20; color: ${secondaryColor}; border: 1px solid ${secondaryColor}; }
  .footer { text-align: center; font-size: 8pt; color: #9ca3af; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  .terms { margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 8.5pt; color: #64748b; }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${branding?.logo_url ? `<img src="${branding.logo_url}" style="max-height:70px;max-width:200px;object-fit:contain;" alt="Logo">` : ''}
      ${!branding?.logo_url ? `<div class="company-name">${companyName}</div>` : ''}
      ${branding?.logo_url ? `<div class="company-name" style="margin-top:8px;">${companyName}</div>` : ''}
      ${branding?.contact_info ? `<div style="font-size:8.5pt;color:#64748b;margin-top:4px;">${branding.contact_info}</div>` : ''}
      ${branding?.company_details ? `<div style="font-size:8.5pt;color:#64748b;">${branding.company_details}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="doc-badge">${docTypeLabel}</div>
      <div style="margin-top:12px;font-size:9pt;">
        <strong>No:</strong> ${invoice.invoice_no}<br>
        <strong>Date:</strong> ${formatDate(invoice.issue_date)}<br>
        ${invoice.due_date ? `<strong>Due:</strong> ${formatDate(invoice.due_date)}<br>` : ''}
        <span class="badge-status">${invoice.status?.toUpperCase()}</span>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h4>Bill To</h4>
      <p><strong>${invoice.client_name}</strong></p>
      ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ''}
      ${invoice.client_email ? `<p>${invoice.client_email}</p>` : ''}
      ${invoice.client_phone ? `<p>${invoice.client_phone}</p>` : ''}
    </div>
    ${invoice.projects?.title ? `
    <div class="info-box">
      <h4>Project Reference</h4>
      <p>${invoice.projects.title}</p>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th>Description</th>
        <th style="width:8%" class="center">Unit</th>
        <th style="width:8%" class="right">Qty</th>
        <th style="width:14%" class="right">Unit Price</th>
        <th style="width:14%" class="right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td class="right">${formatNaira(invoice.subtotal)}</td></tr>
      ${invoice.vat_percent > 0 ? `<tr><td>VAT (${invoice.vat_percent}%)</td><td class="right">${formatNaira(invoice.vat_amount)}</td></tr>` : ''}
      ${invoice.discount_percent > 0 ? `<tr><td>Discount (${invoice.discount_percent}%)</td><td class="right">-${formatNaira(invoice.discount_amount)}</td></tr>` : ''}
      <tr class="grand"><td>TOTAL (NGN)</td><td class="right">${formatNaira(invoice.total_amount)}</td></tr>
    </table>
  </div>

  ${invoice.notes ? `<div class="terms"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
  ${invoice.terms ? `<div class="terms" style="margin-top:8px;"><strong>Terms & Conditions:</strong> ${invoice.terms}</div>` : ''}

  ${branding?.signature_url ? `
  <div style="margin-top:32px;">
    <img src="${branding.signature_url}" style="max-height:50px;">
    <div style="font-size:9pt;margin-top:4px;color:#64748b;">${companyName}</div>
  </div>` : ''}

  <div class="footer">Generated by QSToolkit · qstoolkit.com · Built for Nigerian Quantity Surveyors</div>
</body>
</html>`;
}
