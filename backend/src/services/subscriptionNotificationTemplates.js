/**
 * Subscription Notification Templates
 * Email templates for subscription lifecycle events
 */

const logger = require('../utils/logger');

/**
 * Send subscription expiry reminder email
 * Called by scheduler when subscription is expiring soon
 * @param {object} params - {email, userName, plan, expiresAt, daysUntil}
 */
exports.sendSubscriptionExpiryReminder = async (params, emailService) => {
  try {
    const { email, userName, plan, expiresAt, daysUntil } = params;

    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `⏰ Your QSToolkit ${plan.toUpperCase()} subscription expires in ${daysUntil} days`;

    const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a3c5e 0%, #2d5a8c 100%); color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Your Subscription is Expiring</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #1a3c5e; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
          Your <strong>${plan.toUpperCase()}</strong> subscription will expire on <strong style="color: #dc2626;">${expiryDate}</strong> (in <strong>${daysUntil} day${daysUntil > 1 ? 's' : ''}</strong>).
        </p>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
          To continue enjoying uninterrupted access to premium features, please renew your subscription now.
        </p>
        
        <div style="background: white; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            💡 <strong>Tip:</strong> Users without an active subscription will be downgraded to the free tier after expiration, with access to limited features.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://qs.solnuv.com/subscription" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Renew Subscription
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #64748b; margin: 0;">
          Questions? Reply to this email or contact us at <a href="mailto:support@qs.solnuv.com" style="color: #1a3c5e; text-decoration: none;">support@qs.solnuv.com</a>
        </p>
      </div>
    </div>
    `;

    const textContent = `
Your subscription is expiring soon!

Hi ${userName},

Your ${plan.toUpperCase()} subscription will expire on ${expiryDate} (in ${daysUntil} day${daysUntil > 1 ? 's' : ''}).

To continue enjoying uninterrupted access to premium features, please renew your subscription.

Renew now: https://qs.solnuv.com/subscription

After expiration, you will be downgraded to the free tier with limited access to features.

Questions? Contact us at support@qs.solnuv.com
    `;

    // Use the provided emailService to send
    if (emailService && emailService.sendRawEmail) {
      return await emailService.sendRawEmail({
        to: email,
        subject,
        html: htmlContent,
        text: textContent,
      });
    }

    logger.warn('Email service not available for subscription expiry reminder');
  } catch (err) {
    logger.error('Error sending subscription expiry reminder', {
      email: params.email,
      error: err.message,
    });
    throw err;
  }
};

/**
 * Send subscription downgrade notice
 * Called when user's subscription expires and they're downgraded to free tier
 * @param {object} params - {email, userName, previousPlan}
 */
exports.sendSubscriptionDowngradeNotice = async (params, emailService) => {
  try {
    const { email, userName, previousPlan } = params;

    const subject = `Your QSToolkit subscription has expired - Downgraded to Free tier`;

    const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Subscription Expired</h1>
      </div>
      
      <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #1a3c5e; margin: 0 0 20px 0;">
          Hi <strong>${userName}</strong>,
        </p>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
          Your <strong>${previousPlan.toUpperCase()}</strong> subscription has expired. Your account has been automatically downgraded to our <strong>Free tier</strong>.
        </p>
        
        <div style="background: white; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>What changed:</strong> You now have access to limited features. To restore full access, please renew your subscription.
          </p>
        </div>
        
        <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 20px 0;">
          Your data is safe and hasn't been deleted. Simply renew your subscription to regain access to all premium features.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://qs.solnuv.com/subscription" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Renew Now
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #64748b; margin: 0;">
          Need help? Contact us at <a href="mailto:support@qs.solnuv.com" style="color: #1a3c5e; text-decoration: none;">support@qs.solnuv.com</a>
        </p>
      </div>
    </div>
    `;

    const textContent = `
Your subscription has expired - Downgraded to Free tier

Hi ${userName},

Your ${previousPlan.toUpperCase()} subscription has expired. Your account has been downgraded to our Free tier.

What changed: You now have access to limited features. To restore full access, please renew your subscription.

Your data is safe. Simply renew to regain full access.

Renew now: https://qs.solnuv.com/subscription

Questions? Contact us at support@qs.solnuv.com
    `;

    // Use the provided emailService to send
    if (emailService && emailService.sendRawEmail) {
      return await emailService.sendRawEmail({
        to: email,
        subject,
        html: htmlContent,
        text: textContent,
      });
    }

    logger.warn('Email service not available for subscription downgrade notice');
  } catch (err) {
    logger.error('Error sending subscription downgrade notice', {
      email: params.email,
      error: err.message,
    });
    throw err;
  }
};

module.exports = exports;
