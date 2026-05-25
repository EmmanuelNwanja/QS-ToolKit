/**
 * Direct Payment Submission Service
 * Handles user bank transfer submissions and receipt management
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Submit a bank transfer receipt for admin verification
 * @param {string} userId - User ID
 * @param {object} submissionData - {planName, billingInterval, amountNgn, referenceNote}
 * @param {Buffer} receiptFile - Receipt file buffer
 * @returns {Promise<object>} - Submission record
 */
exports.submitBankTransfer = async (userId, submissionData, receiptFile) => {
  try {
    const {
      planName,
      billingInterval = 'monthly',
      amountNgn,
      referenceNote,
    } = submissionData;

    if (!userId || !planName || !amountNgn) {
      throw new Error('Missing required fields: planName, amountNgn');
    }

    if (!['basic', 'pro', 'enterprise'].includes(planName)) {
      throw new Error(`Invalid plan: ${planName}`);
    }

    if (!['monthly', 'annual'].includes(billingInterval)) {
      throw new Error(`Invalid billingInterval: ${billingInterval}`);
    }

    // Upload receipt to Supabase Storage if provided
    let receiptUrl = null;
    if (receiptFile) {
      const fileName = `payment-receipts/${userId}/${Date.now()}-${receiptFile.originalname}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payments')
        .upload(fileName, receiptFile.buffer, {
          contentType: receiptFile.mimetype,
          upsert: false,
        });

      if (uploadError) {
        logger.warn('Failed to upload receipt to storage', {
          userId,
          error: uploadError.message,
        });
        // Continue without receipt URL - admin can still review
      } else {
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('payments')
          .getPublicUrl(fileName);
        receiptUrl = urlData?.publicUrl || null;
      }
    }

    // Create submission record
    const { data: submission, error: submitError } = await supabase
      .from('direct_payment_submissions')
      .insert({
        user_id: userId,
        plan_name: planName,
        billing_interval: billingInterval,
        amount_ngn: parseFloat(amountNgn),
        receipt_url: receiptUrl,
        reference_note: referenceNote || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (submitError) {
      logger.error('Error submitting payment', { userId, error: submitError.message });
      throw submitError;
    }

    logger.info(`Payment submission created: ${submission.id} for user ${userId}`, {
      planName,
      amountNgn,
      billingInterval,
    });

    return submission;
  } catch (err) {
    logger.error('submitBankTransfer error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get all pending submissions for a user
 * @param {string} userId - User ID
 * @returns {Promise<array>} - Array of submissions
 */
exports.getUserSubmissions = async (userId) => {
  try {
    const { data: submissions, error } = await supabase
      .from('direct_payment_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return submissions || [];
  } catch (err) {
    logger.error('getUserSubmissions error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get a specific submission
 * @param {string} submissionId - Submission ID
 * @returns {Promise<object>} - Submission record
 */
exports.getSubmission = async (submissionId) => {
  try {
    const { data: submission, error } = await supabase
      .from('direct_payment_submissions')
      .select('*, reviewed_by_user:users!reviewed_by(id, name, email)')
      .eq('id', submissionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return submission;
  } catch (err) {
    logger.error('getSubmission error', { submissionId, error: err.message });
    throw err;
  }
};

/**
 * Get pending count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Count of pending submissions
 */
exports.getPendingCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('direct_payment_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  } catch (err) {
    logger.error('getPendingCount error', { userId, error: err.message });
    throw err;
  }
};

module.exports = exports;
