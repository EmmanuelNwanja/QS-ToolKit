const supabase = require('../config/supabase');
const { success, error } = require('../utils/responseHelper');
const logger = require('../utils/logger');

exports.getBankTransferSettings = async (req, res, next) => {
  try {
    const { data: settings, error: err } = await supabase
      .from('platform_payment_settings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) throw err;

    return res.json(success('Bank transfer settings', { data: settings || null }));
  } catch (err) {
    logger.error('getBankTransferSettings error', { error: err.message });
    res.status(500).json(error('Failed to retrieve bank transfer settings'));
  }
};

exports.getBankTransferSettingsAdmin = async (req, res, next) => {
  try {
    const { data: settings, error: err } = await supabase
      .from('platform_payment_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) throw err;

    return res.json(success('Bank transfer settings', { data: settings || null }));
  } catch (err) {
    logger.error('getBankTransferSettingsAdmin error', { error: err.message });
    res.status(500).json(error('Failed to retrieve bank transfer settings'));
  }
};

exports.updateBankTransferSettings = async (req, res, next) => {
  try {
    const { bank_name, account_name, account_number, additional_instructions, is_active } = req.body;

    if (!bank_name || !account_name || !account_number) {
      return res.status(400).json(error('bank_name, account_name, and account_number are required'));
    }

    const { data: existing, error: findErr } = await supabase
      .from('platform_payment_settings')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) throw findErr;

    let result;
    if (existing) {
      const { data: updated, error: err } = await supabase
        .from('platform_payment_settings')
        .update({
          bank_name,
          account_name,
          account_number,
          additional_instructions: additional_instructions || null,
          is_active: is_active !== false,
          updated_by: req.adminUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (err) throw err;
      result = updated;
    } else {
      const { data: created, error: err } = await supabase
        .from('platform_payment_settings')
        .insert({
          bank_name,
          account_name,
          account_number,
          additional_instructions: additional_instructions || null,
          is_active: is_active !== false,
          updated_by: req.adminUser.id,
        })
        .select('*')
        .single();

      if (err) throw err;
      result = created;
    }

    return res.json(success('Bank transfer settings updated', { data: result }));
  } catch (err) {
    logger.error('updateBankTransferSettings error', { adminId: req.adminUser?.id, error: err.message });
    res.status(500).json(error(err.message || 'Failed to update bank transfer settings'));
  }
};

exports.getMyPaymentSubmissions = async (req, res, next) => {
  try {
    const { data: submissions, error: err } = await supabase
      .from('direct_payment_submissions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('submitted_at', { ascending: false });

    if (err) throw err;
    return res.json(success('Payment submissions', { data: submissions || [] }));
  } catch (err) {
    logger.error('getMyPaymentSubmissions error', { userId: req.user?.id, error: err.message });
    res.status(500).json(error('Failed to retrieve payment submissions'));
  }
};
