/**
 * Admin Payment Management Endpoints
 * Handles verification and rejection of direct bank transfer payments
 */

const adminPaymentService = require('../services/adminPaymentService');
const { success, error } = require('../utils/responseHelper');
const { logAdminActivity } = require('../middlewares/adminMiddleware');
const logger = require('../utils/logger');

/**
 * GET /api/admin/payments
 * List all payment submissions with optional status filter
 */
exports.listPayments = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;

    const result = await adminPaymentService.listPaymentSubmissions({
      status,
      page: Number(page),
      limit: Number(limit),
    });

    await logAdminActivity(
      req.adminUser?.id,
      'viewed_payment_submissions',
      'payments',
      'all',
      { status, page, limit },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Payment submissions retrieved', result));
  } catch (err) {
    logger.error('listPayments error', { adminId: req.adminUser?.id, error: err.message });
    return res.status(500).json(error(err.message || 'Failed to list payments'));
  }
};

/**
 * GET /api/admin/payments/:submissionId
 * Get detailed payment submission for review
 */
exports.getPaymentDetail = async (req, res, next) => {
  try {
    const { submissionId } = req.params;

    const submission = await adminPaymentService.getPaymentSubmissionDetail(submissionId);
    if (!submission) {
      return res.status(404).json(error('Payment submission not found'));
    }

    await logAdminActivity(
      req.adminUser?.id,
      'viewed_payment_submission_detail',
      'payment_submission',
      submissionId,
      {},
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Payment details retrieved', submission));
  } catch (err) {
    logger.error('getPaymentDetail error', { submissionId: req.params?.submissionId, error: err.message });
    return res.status(500).json(error(err.message || 'Failed to get payment details'));
  }
};

/**
 * POST /api/admin/payments/:submissionId/verify
 * Verify (approve) a payment submission and activate subscription
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { adminNote = '' } = req.body;

    const result = await adminPaymentService.verifyPaymentSubmission(
      submissionId,
      req.adminUser.id,
      adminNote
    );

    await logAdminActivity(
      req.adminUser?.id,
      'verified_payment_submission',
      'payment_submission',
      submissionId,
      { adminNote, planName: result.subscription.plan_name },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Payment verified and subscription activated', {
      submissionId,
      status: 'verified',
      subscription: result.subscription,
      expiresAt: result.expiresAt,
    }));
  } catch (err) {
    logger.error('verifyPayment error', { submissionId: req.params?.submissionId, error: err.message });
    return res.status(500).json(error(err.message || 'Failed to verify payment'));
  }
};

/**
 * POST /api/admin/payments/:submissionId/reject
 * Reject a payment submission
 */
exports.rejectPayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { reason = '' } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json(error('Rejection reason is required'));
    }

    const updated = await adminPaymentService.rejectPaymentSubmission(
      submissionId,
      req.adminUser.id,
      reason
    );

    await logAdminActivity(
      req.adminUser?.id,
      'rejected_payment_submission',
      'payment_submission',
      submissionId,
      { reason },
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Payment submission rejected', {
      submissionId,
      status: 'rejected',
      rejectionReason: reason.trim(),
    }));
  } catch (err) {
    logger.error('rejectPayment error', { submissionId: req.params?.submissionId, error: err.message });
    return res.status(500).json(error(err.message || 'Failed to reject payment'));
  }
};

/**
 * GET /api/admin/payments/stats
 * Get payment statistics for dashboard
 */
exports.getPaymentStats = async (req, res, next) => {
  try {
    const stats = await adminPaymentService.getPaymentStats();

    await logAdminActivity(
      req.adminUser?.id,
      'viewed_payment_stats',
      'payments',
      'all',
      {},
      req.ip,
      req.get('user-agent')
    );

    return res.json(success('Payment statistics retrieved', stats));
  } catch (err) {
    logger.error('getPaymentStats error', { adminId: req.adminUser?.id, error: err.message });
    return res.status(500).json(error(err.message || 'Failed to get payment stats'));
  }
};

module.exports = exports;
