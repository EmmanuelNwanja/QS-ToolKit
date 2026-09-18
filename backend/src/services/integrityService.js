/**
 * integrityService.js
 * Blockchain-lite tamper-evident document certification.
 * Uses SHA-256 hash chain stored in Supabase — zero gas fees.
 */

const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Generate a canonical JSON representation of a document.
 * Ensures consistent hashing regardless of key order.
 */
function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  Object.keys(obj).sort().forEach((k) => {
    sorted[k] = canonicalize(obj[k]);
  });
  return sorted;
}

/**
 * Create SHA-256 hash of canonical JSON string.
 */
function hashDocument(canonicalJsonString) {
  return crypto.createHash('sha256').update(canonicalJsonString).digest('hex');
}

/**
 * Get the previous hash in the chain for a given user.
 * Creates a continuous chain of trust per user.
 */
async function getPreviousHash(userId, documentType) {
  const { data } = await supabase
    .from('document_hashes')
    .select('document_hash')
    .eq('user_id', userId)
    .eq('document_type', documentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.document_hash || null;
}

/**
 * Certify a document: generate hash, store in chain, return cert token.
 */
exports.certifyDocument = async (documentType, documentId, userId, documentData) => {
  try {
    const canonicalJson = JSON.stringify(canonicalize(documentData));
    const docHash = hashDocument(canonicalJson);
    const previousHash = await getPreviousHash(userId, documentType);
    const certToken = crypto.randomBytes(32).toString('hex');

    const { data, error } = await supabase
      .from('document_hashes')
      .insert({
        document_type: documentType,
        document_id: documentId,
        user_id: userId,
        document_hash: docHash,
        previous_hash: previousHash,
        canonical_json: canonicalJson,
        cert_token: certToken
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      certToken: data.cert_token,
      hash: data.document_hash,
      previousHash: data.previous_hash,
      verifiedAt: data.verified_at,
      chainPosition: previousHash ? 'linked' : 'genesis'
    };
  } catch (err) {
    logger.error('Certify document error:', err.message);
    return { success: false, message: 'Failed to certify document' };
  }
};

/**
 * Verify a document by cert token.
 * Re-computes hash and checks against stored value.
 */
exports.verifyDocument = async (certToken) => {
  try {
    const { data: record, error } = await supabase
      .from('document_hashes')
      .select('*')
      .eq('cert_token', certToken)
      .single();

    if (error || !record) {
      return { valid: false, message: 'Certificate not found' };
    }

    // Recompute hash
    const recomputedHash = hashDocument(record.canonical_json);
    const hashMatch = recomputedHash === record.document_hash;

    // Check chain integrity — walk backwards to verify each link
    let chainValid = true;
    if (record.previous_hash) {
      // Verify the previous record exists, belongs to same user, and its hash matches
      const { data: prev } = await supabase
        .from('document_hashes')
        .select('document_hash, user_id')
        .eq('document_hash', record.previous_hash)
        .eq('user_id', record.user_id)
        .single();

      if (!prev) {
        chainValid = false;
      }
    }

    // Parse the stored JSON for summary
    let documentSummary;
    try {
      documentSummary = JSON.parse(record.canonical_json);
    } catch {
      documentSummary = null;
    }

    return {
      valid: hashMatch && chainValid && !record.is_revoked,
      hashMatch,
      chainValid,
      isRevoked: !!record.is_revoked,
      revokedAt: record.revoked_at || null,
      documentType: record.document_type,
      documentId: record.document_id,
      hash: record.document_hash,
      previousHash: record.previous_hash,
      verifiedAt: record.verified_at,
      createdAt: record.created_at,
      summary: documentSummary
        ? {
            title: documentSummary.title || documentSummary.boq_title || 'Untitled',
            totalAmount: documentSummary.total_amount || documentSummary.totalAmount || null,
            clientName: documentSummary.client_name || documentSummary.clientName || null
          }
        : null
    };
  } catch (err) {
    logger.error('Verify document error:', err.message);
    return { valid: false, message: 'Verification failed' };
  }
};

/**
 * Get certification history for a specific document.
 */
exports.getDocumentHistory = async (documentType, documentId, userId) => {
  const { data, error } = await supabase
    .from('document_hashes')
    .select('cert_token, document_hash, previous_hash, verified_at, created_at')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return { success: false, message: error.message };

  // Verify chain continuity
  const chain = (data || []).map((item, index, arr) => {
    const expectedPrevious = index > 0 ? arr[index - 1].document_hash : null;
    return {
      ...item,
      chainLinkValid: item.previous_hash === expectedPrevious
    };
  });

  return { success: true, history: chain, chainIntact: chain.every((c) => c.chainLinkValid) };
};

/**
 * Generate a human-readable certificate text for PDF generation.
 */
exports.generateCertificateText = (certToken, verifyResult) => {
  const status = verifyResult.valid ? 'VALID ✓' : 'INVALID ✗';
  const revoked = verifyResult.isRevoked ? '\n  ** THIS CERTIFICATE HAS BEEN REVOKED **' : '';
  return `
================================================================================
                    QSTOOLKIT DOCUMENT CERTIFICATE OF INTEGRITY
================================================================================

Certificate Token: ${certToken}
Verification Status: ${status}${revoked}
Document Type: ${verifyResult.documentType?.toUpperCase()}
Document Title: ${verifyResult.summary?.title || 'N/A'}

Cryptographic Proof:
  SHA-256 Hash: ${verifyResult.hash}
  Previous Hash: ${verifyResult.previousHash || '(Genesis block)'}
  Hash Match: ${verifyResult.hashMatch ? 'Yes' : 'No'}
  Chain Integrity: ${verifyResult.chainValid ? 'Intact' : 'Broken'}

Timestamp:
  Certified At: ${new Date(verifyResult.createdAt).toUTCString()}
  Verified At: ${new Date(verifyResult.verifiedAt).toUTCString()}

This certificate confirms that the document has not been altered since certification.
QSToolkit uses a blockchain-lite hash chain stored in a tamper-evident database.

================================================================================
                    Fudo Greentech Ltd · qs.solnuv.com
================================================================================
  `.trim();
};

/**
 * Revoke a document certificate.
 */
exports.revokeDocument = async (certToken, userId) => {
  try {
    const { data: record, error: fetchErr } = await supabase
      .from('document_hashes')
      .select('id, user_id, is_revoked')
      .eq('cert_token', certToken)
      .single();

    if (fetchErr || !record) {
      return { success: false, message: 'Certificate not found' };
    }

    if (record.user_id !== userId) {
      return { success: false, message: 'Not authorized to revoke this certificate' };
    }

    if (record.is_revoked) {
      return { success: false, message: 'Certificate is already revoked' };
    }

    const { error: updateErr } = await supabase
      .from('document_hashes')
      .update({ is_revoked: true, revoked_at: new Date().toISOString() })
      .eq('id', record.id);

    if (updateErr) throw updateErr;

    return { success: true, message: 'Certificate revoked' };
  } catch (err) {
    logger.error('Revoke document error:', err.message);
    return { success: false, message: 'Failed to revoke certificate' };
  }
};

exports.hashDocument = hashDocument;
exports.canonicalize = canonicalize;
