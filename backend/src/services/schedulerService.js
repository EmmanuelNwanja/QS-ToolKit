/**
 * schedulerService.js
 * Called by GitHub Actions cron (daily 8AM WAT) via a secured HTTP endpoint
 * OR can run inline with node-cron if you prefer
 */
const cron = require('node-cron');
const axios = require('axios');
const supabase = require('../config/supabase');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

// ── Expire subscriptions ──────────────────────────────────────
async function expireSubscriptions() {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ subscription_status: 'inactive' })
      .lt('subscription_expires_at', new Date().toISOString())
      .eq('subscription_status', 'active');

    logger.info(`Subscription expiry check complete. Expired: ${data?.length || 0}`);
  } catch (err) {
    logger.error('Subscription expiry job failed:', err.message);
  }
}

// ── Remind users whose subscription expires in 3 days ────────
async function sendExpiryReminders() {
  try {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const in4Days = new Date();
    in4Days.setDate(in4Days.getDate() + 4);

    const { data: users } = await supabase
      .from('users')
      .select('email, name, subscription_plans(name)')
      .eq('subscription_status', 'active')
      .gte('subscription_expires_at', in3Days.toISOString())
      .lt('subscription_expires_at', in4Days.toISOString());

    for (const user of users || []) {
      await emailService.sendExpiryReminder({
        email:     user.email,
        name:      user.name,
        planName:  user.subscription_plans?.name,
        expiresAt: user.subscription_expires_at,
        renewUrl:  `${process.env.FRONTEND_URL}/subscription`
      });
    }

    logger.info(`Sent ${users?.length || 0} expiry reminder emails`);
  } catch (err) {
    logger.error('Expiry reminder job failed:', err.message);
  }
}

// ── Refresh leaderboard ───────────────────────────────────────
async function refreshLeaderboard() {
  try {
    await supabase.rpc('refresh_leaderboard');
    logger.info('Leaderboard refreshed');
  } catch (err) {
    logger.error('Leaderboard refresh failed:', err.message);
  }
}

// ── Auto-renew subscriptions ───────────────────────────────────
async function autoRenewSubscriptions() {
  try {
    logger.info('🔄 Starting auto-renewal job...');
    
    // Query users eligible for auto-renewal:
    // - auto_renew = true
    // - subscription_status = 'active'
    // - subscription_expires_at is today or earlier (expired/expiring)
    const now = new Date().toISOString();
    const { data: users, error: queryErr } = await supabase
      .from('users')
      .select('id, email, plan_id, subscription_expires_at, billing_cycle, subscription_plans(name, price_monthly, price_annual)')
      .eq('auto_renew', true)
      .eq('subscription_status', 'active')
      .lte('subscription_expires_at', now);

    if (queryErr) throw new Error(`Query failed: ${queryErr.message}`);

    if (!users || users.length === 0) {
      logger.info('No subscriptions eligible for auto-renewal');
      return;
    }

    logger.info(`Found ${users.length} subscriptions eligible for auto-renewal`);

    let successCount = 0;
    let failureCount = 0;

    // Process each user
    for (const user of users) {
      try {
        if (!user.plan_id || !user.subscription_plans?.name) {
          logger.warn(`User ${user.id} has no valid plan. Skipping.`);
          failureCount++;
          continue;
        }

        const billingCycle = user.billing_cycle || 'monthly';
        const plan = user.subscription_plans;
        const basePrice = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;

        if (!basePrice || Number(basePrice) <= 0) {
          logger.warn(`User ${user.id} plan has no payable price. Skipping.`);
          failureCount++;
          continue;
        }

        // Initiate Paystack renewal transaction
        const paystackRes = await axios.post(
          `${PAYSTACK_BASE}/transaction/initialize`,
          {
            email: user.email,
            amount: Math.round(Number(basePrice) * 100),
            currency: 'NGN',
            metadata: {
              user_id: user.id,
              plan_id: user.plan_id,
              plan_name: plan.name,
              billing_cycle: billingCycle,
              is_philanthropist: false,
              is_auto_renewal: true,
              custom_fields: [
                { display_name: 'Plan', variable_name: 'plan', value: plan.name },
                { display_name: 'Billing', variable_name: 'billing', value: billingCycle },
                { display_name: 'Type', variable_name: 'type', value: 'auto_renewal' }
              ]
            },
            callback_url: `${process.env.FRONTEND_URL}/subscription`
          },
          { headers: paystackHeaders() }
        );

        // Log renewal attempt
        const reference = paystackRes.data.data?.reference;
        if (reference) {
          await supabase.from('subscription_renewal_attempts').insert({
            user_id: user.id,
            plan_id: user.plan_id,
            plan_name: plan.name,
            billing_cycle: billingCycle,
            amount: Number(basePrice),
            paystack_reference: reference,
            status: 'initiated',
            attempted_at: new Date().toISOString()
          });

          logger.info(`Auto-renewal transaction initiated for user ${user.id}: ${reference}`);
          successCount++;
        }
      } catch (renewErr) {
        logger.error(`Auto-renewal failed for user ${user.id}: ${renewErr.message}`);
        failureCount++;

        // Log failed attempt
        try {
          await supabase.from('subscription_renewal_attempts').insert({
            user_id: user.id,
            plan_id: user.plan_id,
            plan_name: user.subscription_plans?.name,
            billing_cycle: user.billing_cycle || 'monthly',
            amount: user.subscription_plans ? Number(user.subscription_plans.price_monthly) : 0,
            paystack_reference: null,
            status: 'failed',
            error_message: renewErr.message,
            attempted_at: new Date().toISOString()
          });
        } catch (logErr) {
          logger.warn(`Failed to log renewal attempt for user ${user.id}: ${logErr.message}`);
        }
      }
    }

    logger.info(`✅ Auto-renewal job complete. Success: ${successCount}, Failures: ${failureCount}`);
  } catch (err) {
    logger.error('Auto-renewal job failed:', err.message);
  }
}

// ── Run all jobs (called by GitHub Actions endpoint) ─────────
exports.runAllJobs = async () => {
  logger.info('🕗 Running scheduled jobs...');
  await expireSubscriptions();
  await sendExpiryReminders();
  await autoRenewSubscriptions();
  await refreshLeaderboard();
  logger.info('✅ Scheduled jobs complete');
};

// ── Start inline cron (optional - only if not using GitHub Actions) ──
exports.startCron = () => {
  // Every day at 8AM West Africa Time (UTC+1) = 7AM UTC
  cron.schedule('0 7 * * *', async () => {
    await exports.runAllJobs();
  }, { timezone: 'Africa/Lagos' });

  logger.info('⏰ Cron scheduler started (daily 8AM WAT)');
};
