/**
 * schedulerService.js
 * Called by GitHub Actions cron (daily 8AM WAT) via a secured HTTP endpoint
 * OR can run inline with node-cron if you prefer
 */
const cron = require('node-cron');
const supabase = require('../config/supabase');
const emailService = require('./emailService');
const logger = require('../utils/logger');

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

// ── Run all jobs (called by GitHub Actions endpoint) ─────────
exports.runAllJobs = async () => {
  logger.info('🕗 Running scheduled jobs...');
  await expireSubscriptions();
  await sendExpiryReminders();
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
