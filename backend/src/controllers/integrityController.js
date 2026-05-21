const integrityService = require('../services/integrityService');
const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

// ─── Certify a BOQ ────────────────────────────────────────────
exports.certifyBoq = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch full BOQ
    const { data: boq } = await supabase
      .from('boq_documents')
      .select(`
        *,
        boq_sections(
          *,
          boq_items(*)
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!boq) return res.status(404).json(error('BOQ not found', { code: 'BOQ_NOT_FOUND' }));

    // Only allow certification of final/submitted documents
    if (boq.status !== 'final' && boq.status !== 'submitted') {
      return res.status(422).json(error('Only final or submitted BOQs can be certified. Please finalize the BOQ first.', { code: 'BOQ_NOT_FINALIZED' }));
    }

    const result = await integrityService.certifyDocument('boq', id, req.user.id, boq);
    if (!result.success) {
      return res.status(500).json(error(result.message));
    }

    return res.json(success('BOQ certified', {
      certToken: result.certToken,
      hash: result.hash,
      chainPosition: result.chainPosition,
      verifiedAt: result.verifiedAt
    }));
  } catch (err) {
    logger.error('Certify BOQ error:', err.message);
    next(err);
  }
};

// ─── Certify an Invoice ───────────────────────────────────────
exports.certifyInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (!invoice) return res.status(404).json(error('Invoice not found', { code: 'INVOICE_NOT_FOUND' }));

    const result = await integrityService.certifyDocument('invoice', id, req.user.id, invoice);
    if (!result.success) {
      return res.status(500).json(error(result.message));
    }

    return res.json(success('Invoice certified', {
      certToken: result.certToken,
      hash: result.hash,
      chainPosition: result.chainPosition,
      verifiedAt: result.verifiedAt
    }));
  } catch (err) {
    logger.error('Certify invoice error:', err.message);
    next(err);
  }
};

// ─── Verify by Cert Token ─────────────────────────────────────
exports.verify = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await integrityService.verifyDocument(token);

    if (!result.valid) {
      return res.json(success('Verification result', { valid: false, details: result }));
    }

    return res.json(success('Document verified', {
      valid: true,
      documentType: result.documentType,
      documentId: result.documentId,
      hash: result.hash,
      previousHash: result.previousHash,
      hashMatch: result.hashMatch,
      chainValid: result.chainValid,
      verifiedAt: result.verifiedAt,
      createdAt: result.createdAt,
      summary: result.summary
    }));
  } catch (err) {
    logger.error('Verify error:', err.message);
    next(err);
  }
};

// ─── Get Document Certification History ───────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const result = await integrityService.getDocumentHistory(type, id, req.user.id);
    if (!result.success) return res.status(500).json(error(result.message));
    return res.json(success('Certification history', result));
  } catch (err) {
    logger.error('History error:', err.message);
    next(err);
  }
};

// ─── Download Certificate Text ────────────────────────────────
exports.downloadCertificate = async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await integrityService.verifyDocument(token);

    const certText = integrityService.generateCertificateText(token, result);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="QSToolkit-Certificate-${token.slice(0, 8)}.txt"`);
    res.send(certText);
  } catch (err) {
    logger.error('Download certificate error:', err.message);
    next(err);
  }
};
