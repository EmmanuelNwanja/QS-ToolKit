/**
 * schedulerService.js
 * Called by GitHub Actions cron (daily 8AM WAT) via a secured HTTP endpoint
 * OR can run inline with node-cron if you prefer
 */
const cron = require('node-cron');
const supabase = require('../config/supabase');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const subscriptionManagementService = require('./subscriptionManagementService');

// ── Expire subscriptions ──────────────────────────────────────
async function expireSubscriptions() {
  try {
    const now = new Date().toISOString();

    // Mark expired in legacy users table
    const { data, error } = await supabase
      .from('users')
      .update({ subscription_status: 'inactive' })
      .lt('subscription_expires_at', now)
      .eq('subscription_status', 'active');

    // Sync user_subscriptions table
    await supabase
      .from('user_subscriptions')
      .update({ subscription_status: 'expired', updated_at: now })
      .lt('subscription_expires_at', now)
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
      .select('id, email, plan_id, subscription_expires_at, billing_cycle, flutterwave_subscription_id, subscription_plans(name, price_monthly, price_annual)')
      .eq('auto_renew', true)
      .eq('subscription_status', 'active')
      .lte('subscription_expires_at', now);

    if (queryErr) throw new Error(`Query failed: ${queryErr.message}`);

    if (!users || users.length === 0) {
      logger.info('No subscriptions eligible for auto-renewal');
      return;
    }

    logger.info(`Found ${users.length} subscriptions due for auto-renewal review`);

    // Flutterwave recurring subscriptions renew automatically via the
    // Flutterwave API + webhooks — nothing to charge manually here. Users
    // without a Flutterwave subscription simply lapse and are nudged to
    // renew manually (reminders are sent by monitorSubscriptionExpiry).
    let autoRenewing = 0;
    let manual = 0;
    for (const user of users) {
      if (user.flutterwave_subscription_id) {
        autoRenewing++;
      } else {
        manual++;
      }
    }

    logger.info(`✅ Auto-renewal review complete. Flutterwave-managed: ${autoRenewing}, needs manual renewal: ${manual}`);
  } catch (err) {
    logger.error('Auto-renewal review failed:', err.message);
  }
}

// ── Monitor and manage subscription lifecycle (NEW) ──────────────
async function monitorSubscriptionExpiry() {
  try {
    logger.info('🔔 Starting subscription expiry monitoring...');

    // 1. Send 7-day reminders
    const expiring7d = await subscriptionManagementService.getExpiringSubscriptions(7, true);
    for (const sub of expiring7d) {
      try {
        await subscriptionManagementService.sendExpiryReminder(sub.user_id, '7');
        if (sub.users?.email) {
          await emailService.sendExpiryReminder({
            email: sub.users.email,
            name: sub.users?.name || 'User',
            planName: sub.plan_name,
            expiresAt: sub.subscription_expires_at,
            renewUrl: `${process.env.FRONTEND_URL}/subscription`
          }).catch(err => logger.warn('Failed to send 7d reminder email', { userId: sub.user_id, error: err.message }));
        }
      } catch (err) {
        logger.warn(`Failed to send 7d reminder for user ${sub.user_id}`, { error: err.message });
      }
    }
    logger.info(`✅ Sent 7-day reminders to ${expiring7d.length} users`);

    // 2. Send 3-day reminders
    const expiring3d = await subscriptionManagementService.getExpiringSubscriptions(3, true);
    for (const sub of expiring3d) {
      try {
        await subscriptionManagementService.sendExpiryReminder(sub.user_id, '3');
        if (sub.users?.email) {
          await emailService.sendExpiryReminder({
            email: sub.users.email,
            name: sub.users?.name || 'User',
            planName: sub.plan_name,
            expiresAt: sub.subscription_expires_at,
            renewUrl: `${process.env.FRONTEND_URL}/subscription`
          }).catch(err => logger.warn('Failed to send 3d reminder email', { userId: sub.user_id, error: err.message }));
        }
      } catch (err) {
        logger.warn(`Failed to send 3d reminder for user ${sub.user_id}`, { error: err.message });
      }
    }
    logger.info(`✅ Sent 3-day reminders to ${expiring3d.length} users`);

    // 3. Send 1-day reminders
    const expiring1d = await subscriptionManagementService.getExpiringSubscriptions(1, true);
    for (const sub of expiring1d) {
      try {
        await subscriptionManagementService.sendExpiryReminder(sub.user_id, '1');
        if (sub.users?.email) {
          await emailService.sendExpiryReminder({
            email: sub.users.email,
            name: sub.users?.name || 'User',
            planName: sub.plan_name,
            expiresAt: sub.subscription_expires_at,
            renewUrl: `${process.env.FRONTEND_URL}/subscription`
          }).catch(err => logger.warn('Failed to send 1d reminder email', { userId: sub.user_id, error: err.message }));
        }
      } catch (err) {
        logger.warn(`Failed to send 1d reminder for user ${sub.user_id}`, { error: err.message });
      }
    }
    logger.info(`✅ Sent 1-day reminders to ${expiring1d.length} users`);

    // 4. Downgrade expired subscriptions (outside grace period)
    const { data: expiredSubs, error: expiredError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('subscription_status', 'active')
      .lt('grace_period_until', new Date().toISOString());

    if (expiredError) {
      logger.error('Error fetching expired subscriptions', { error: expiredError.message });
    } else if (expiredSubs && expiredSubs.length > 0) {
      let downgradedCount = 0;
      for (const sub of expiredSubs) {
        try {
          const result = await subscriptionManagementService.downgradeToFreeTier(
            sub.user_id,
            'subscription_expired'
          );
          if (result) downgradedCount++;

          // Notify user of downgrade
          const { data: user } = await supabase
            .from('users')
            .select('email, name')
            .eq('id', sub.user_id)
            .maybeSingle();

          if (user?.email) {
            await emailService.sendDowngradeNotice({
              email: user.email,
              name: user.name || 'User',
              previousPlan: sub.plan_name,
            }).catch(err => logger.warn('Failed to send downgrade email', { userId: sub.user_id, error: err.message }));
          }
        } catch (err) {
          logger.warn(`Failed to downgrade user ${sub.user_id}`, { error: err.message });
        }
      }
      logger.info(`✅ Downgraded ${downgradedCount} expired subscriptions to free tier`);
    }

    logger.info('✅ Subscription expiry monitoring complete');
  } catch (err) {
    logger.error('Subscription expiry monitoring failed:', err.message);
  }
}

// ── Run all jobs (called by GitHub Actions endpoint) ─────────
exports.runAllJobs = async () => {
  logger.info('🕗 Running scheduled jobs...');
  await expireSubscriptions();
  await sendExpiryReminders();
  await monitorSubscriptionExpiry(); // NEW: comprehensive subscription lifecycle monitoring
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
