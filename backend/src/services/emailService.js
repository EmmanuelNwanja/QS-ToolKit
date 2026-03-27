/**
 * QSToolkit Email Service
 * Beautiful, brand-consistent HTML emails via Brevo
 * Every email is humanly written, clear, and mobile-responsive
 */

const axios = require('axios');
const logger = require('../utils/logger');

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.SENDINBLUE_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || process.env.SENDINBLUE_SENDER_NAME;
const BRAND = {
  primary:    '#1a3c5e',
  gold:       '#f59e0b',
  light:      '#f8fafc',
  text:       '#334155',
  muted:      '#64748b',
  border:     '#e2e8f0',
  name:       'QSToolkit',
  url:        'https://qs.solnuv.com',
  email:      'hello@qstoolkit.com',
  tagline:    "Nigeria's Quantity Surveying Platform"
};

if (!BREVO_API_KEY) {
  logger.error('Email service misconfigured: BREVO_API_KEY (or SENDINBLUE_API_KEY) is missing');
}

if (!BREVO_SENDER_EMAIL) {
  logger.warn('BREVO_SENDER_EMAIL missing; using fallback sender. Verify sender/domain in Brevo to avoid rejection.');
}

// ── Core send function ────────────────────────────────────────
async function send({ to, subject, html, attachments = [] }) {
  try {
    if (!BREVO_API_KEY) {
      logger.error({
        message: 'Email send skipped: missing Brevo API key',
        subject,
        to
      });
      return false;
    }

    const recipients = (Array.isArray(to) ? to : [to]).map((entry) => {
      if (typeof entry === 'string') return { email: entry };
      return entry;
    }).filter((entry) => entry && entry.email);

    if (!recipients.length) {
      logger.error({ message: 'Email send skipped: no valid recipients', subject, to });
      return false;
    }

    await axios.post(BREVO_API, {
      sender:     { name: BREVO_SENDER_NAME || BRAND.name, email: BREVO_SENDER_EMAIL || BRAND.email },
      to:         recipients,
      subject,
      htmlContent: html,
      attachment: attachments.length ? attachments : undefined
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return true;
  } catch (err) {
    logger.error({
      message: 'Email delivery failed',
      subject,
      to,
      status: err.response?.status,
      provider_error: err.response?.data || err.message
    });
    return false;
  }
}

// ── Layout wrapper — every email uses this ────────────────────
function layout({ preheader = '', body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${BRAND.name}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:transparent;font-size:1px;line-height:1px;">
    ${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${BRAND.primary};border-radius:12px;padding:10px 20px;">
                  <span style="color:${BRAND.gold};font-size:18px;font-weight:700;letter-spacing:-0.5px;">QS</span>
                  <span style="color:#ffffff;font-size:18px;font-weight:700;margin-left:4px;">Toolkit</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card body -->
        <tr>
          <td style="background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:28px 0 8px;">
            <p style="margin:0;color:${BRAND.muted};font-size:12px;line-height:1.6;">
              ${BRAND.tagline} · <a href="${BRAND.url}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.url}</a>
            </p>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
              You're receiving this because you have a QSToolkit account.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared UI components ──────────────────────────────────────
const divider = `<tr><td style="padding:0 32px;"><div style="height:1px;background:${BRAND.border};"></div></td></tr>`;

function heroSection({ emoji, title, subtitle }) {
  return `
    <tr>
      <td style="background:${BRAND.primary};padding:40px 32px 32px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">${emoji}</div>
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">${title}</h1>
        ${subtitle ? `<p style="margin:10px 0 0;color:#94a3b8;font-size:15px;">${subtitle}</p>` : ''}
      </td>
    </tr>`;
}

function bodySection(content) {
  return `<tr><td style="padding:32px;">${content}</td></tr>`;
}

function ctaButton(text, url) {
  return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 8px;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background:${BRAND.gold};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.2px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:${BRAND.muted};font-size:13px;">${label}</td>
            <td align="right" style="color:${BRAND.text};font-size:13px;font-weight:600;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function featureList(items) {
  return items.map(item => `
    <tr>
      <td style="padding:6px 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:${BRAND.gold};font-size:16px;padding-right:10px;vertical-align:top;">✓</td>
            <td style="color:${BRAND.text};font-size:14px;line-height:1.5;">${item}</td>
          </tr>
        </table>
      </td>
    </tr>`).join('');
}

function bodyText(text, style = '') {
  return `<p style="margin:0 0 16px;color:${BRAND.text};font-size:15px;line-height:1.7;${style}">${text}</p>`;
}

function sectionTitle(text) {
  return `<p style="margin:24px 0 12px;color:${BRAND.primary};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${text}</p>`;
}

function noteBox(text, type = 'info') {
  const colors = {
    info:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: BRAND.gold, text: '#92400e' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#14532d' }
  };
  const c = colors[type] || colors.info;
  return `
    <div style="background:${c.bg};border-left:4px solid ${c.border};border-radius:0 8px 8px 0;padding:14px 16px;margin:20px 0;">
      <p style="margin:0;color:${c.text};font-size:13px;line-height:1.6;">${text}</p>
    </div>`;
}

// ════════════════════════════════════════════════════════════════
//  EMAIL VERIFICATION
// ════════════════════════════════════════════════════════════════
exports.sendEmailVerification = async (user, token) => {
  const firstName = user.name?.split(' ')[0] || 'there';
  const verifyUrl = `${BRAND.url}/auth/verify-email?token=${token}`;

  const html = layout({
    preheader: `Verify your QSToolkit account to activate access`,
    body: `
      ${heroSection({ emoji: '📧', title: 'Verify Your Email', subtitle: 'One quick step to activate your account.' })}
      ${bodySection(`
        ${bodyText(`Hi ${firstName}, thanks for creating your QSToolkit account.`)}
        ${bodyText(`To activate your account and start using the platform, please verify your email address.`)}
        ${ctaButton('Verify My Email →', verifyUrl)}
        ${noteBox('This verification link expires in 30 minutes. If it expires, you can request a new one from the login page.', 'warning')}
      `)}
    `
  });

  await send({
    to: user.email,
    subject: 'Verify your QSToolkit email',
    html
  });
};

// ════════════════════════════════════════════════════════════════
//  WELCOME EMAIL
// ════════════════════════════════════════════════════════════════
exports.sendWelcome = async (user) => {
  const firstName = user.name?.split(' ')[0] || 'there';
  const html = layout({
    preheader: `Welcome to QSToolkit, ${firstName}! Your account is ready.`,
    body: `
      ${heroSection({ emoji: '🎉', title: `Welcome, ${firstName}!`, subtitle: 'Your account is ready to go.' })}
      ${bodySection(`
        ${bodyText(`We're glad you're here. QSToolkit gives you every tool you need to work as a professional quantity surveyor — right from your browser, on any device.`)}
        ${bodyText(`Here's what you can do right now:`)}
        ${sectionTitle('Your QSToolkit Features')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${featureList([
            '🧮 <strong>10+ QS Calculators</strong> — concrete, steel, blockwork, formwork, roofing and more',
            '📋 <strong>Bill of Quantities</strong> — build and export professional BOQs',
            '🧾 <strong>Invoices & Quotations</strong> — branded documents sent to clients',
            '📁 <strong>Project Tracker</strong> — log every job from start to finish',
            '⭐ <strong>Client Feedback</strong> — collect ratings and build your reputation',
            '🏆 <strong>National Leaderboard</strong> — see how you rank among Nigerian QS professionals'
          ])}
        </table>
        ${ctaButton('Go to My Dashboard →', `${BRAND.url}/dashboard`)}
        ${noteBox(`You currently have <strong>3 free calculator uses</strong> on your account. Subscribe to a plan to unlock full access.`, 'info')}
      `)}
    `
  });
  await send({ to: user.email, subject: `Welcome to QSToolkit, ${firstName}!`, html });
};

// ════════════════════════════════════════════════════════════════
//  SUBSCRIPTION CONFIRMATION
// ════════════════════════════════════════════════════════════════
exports.sendSubscriptionConfirmation = async (user, billingCycle = 'monthly', expiresAt) => {
  const firstName  = user.name?.split(' ')[0] || 'there';
  const planName   = user.subscription_plans?.name || 'Pro';
  const cycle      = billingCycle === 'annual' ? 'Annual' : 'Monthly';
  const expiry     = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const planFeatures = {
    basic:      ['2 project logs/month', '30 calculator uses/month', '2 BOQ/month', '2 invoices, 2 valuations, 2 quotations/month', 'PDF & Excel exports', '1 user, 1 device', 'Standard support'],
    pro:        ['5 projects/month', '80 calculator uses/month', '5 BOQ/month', '5 invoices, 5 valuations, 5 quotations/month', 'PDF & Excel exports', '1 user, 2 devices', 'Priority support'],
    enterprise: ['50 projects/month', '700 calculator uses/month', '50 BOQ/month', '50 invoices, 50 valuations, 50 quotations/month', 'PDF & Excel exports', '5 users, 15 devices', 'Team roles & permissions', 'Top priority support']
  };

  const html = layout({
    preheader: `Your ${planName} subscription is now active.`,
    body: `
      ${heroSection({ emoji: '✅', title: 'Subscription Activated!', subtitle: `Your ${planName} plan is live.` })}
      ${bodySection(`
        ${bodyText(`Hi ${firstName}, your payment went through and your <strong>${planName} (${cycle})</strong> plan is now active.`)}
        ${sectionTitle('Your Plan Details')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${infoRow('Plan', `${planName} · ${cycle}`)}
          ${infoRow('Next Renewal / Expiry', expiry)}
        </table>
        ${sectionTitle("What's Included")}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${featureList(planFeatures[planName.toLowerCase()] || [])}
        </table>
        ${ctaButton('Start Using QSToolkit →', `${BRAND.url}/dashboard`)}
        ${noteBox(`Your subscription auto-renews on ${expiry}. You can cancel anytime from <strong>Settings → Subscription</strong>.`, 'info')}
      `)}
    `
  });
  await send({ to: user.email, subject: `Your QSToolkit ${planName} plan is active`, html });
};

// ════════════════════════════════════════════════════════════════
//  CLIENT FEEDBACK REQUEST
// ════════════════════════════════════════════════════════════════
exports.sendFeedbackRequest = async (clientEmail, clientName, feedbackUrl, projectTitle, surveyor, message) => {
  const surveyorName = surveyor.company_name || surveyor.name;
  const greeting     = clientName ? `Hi ${clientName.split(' ')[0]},` : 'Hello,';

  const html = layout({
    preheader: `${surveyorName} would love your feedback on "${projectTitle}"`,
    body: `
      ${heroSection({ emoji: '⭐', title: 'How did we do?', subtitle: `${surveyorName} is asking for your feedback.` })}
      ${bodySection(`
        ${bodyText(greeting)}
        ${bodyText(`<strong>${surveyorName}</strong> has requested your honest rating for the project: <em>${projectTitle}</em>.`)}
        ${message ? `
          <div style="background:${BRAND.light};border-left:4px solid ${BRAND.gold};border-radius:0 8px 8px 0;padding:16px;margin:20px 0;">
            <p style="margin:0;color:${BRAND.muted};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Message from ${surveyorName}</p>
            <p style="margin:0;color:${BRAND.text};font-size:14px;line-height:1.7;font-style:italic;">"${message}"</p>
          </div>` : ''}
        ${bodyText(`It takes less than 2 minutes and helps professionals like ${surveyorName.split(' ')[0]} serve clients better across Nigeria.`)}
        ${ctaButton('Leave My Feedback →', feedbackUrl)}
        ${noteBox('Your rating is completely anonymous. Only the overall score is shown publicly.', 'info')}
      `)}
    `
  });
  await send({
    to: clientEmail,
    subject: `${surveyorName} wants your feedback on "${projectTitle}"`,
    html
  });
};

// ════════════════════════════════════════════════════════════════
//  NEW FEEDBACK NOTIFICATION (to surveyor)
// ════════════════════════════════════════════════════════════════
exports.notifyNewFeedback = async (surveyor, rating) => {
  const firstName = surveyor.name?.split(' ')[0] || 'there';
  const stars = '⭐'.repeat(Math.min(Math.round(rating / 2), 5));

  const html = layout({
    preheader: `A client just rated your work ${rating}/10`,
    body: `
      ${heroSection({ emoji: stars || '⭐', title: `New Rating: ${rating}/10`, subtitle: 'A client has reviewed your work.' })}
      ${bodySection(`
        ${bodyText(`Hi ${firstName}, you just received a new client rating on QSToolkit.`)}
        <div style="background:${BRAND.light};border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
          <p style="margin:0 0 8px;color:${BRAND.muted};font-size:13px;">Overall Rating</p>
          <p style="margin:0;font-size:48px;font-weight:700;color:${BRAND.gold};">${rating}<span style="font-size:24px;color:${BRAND.muted}">/10</span></p>
        </div>
        ${bodyText(`This rating contributes to your overall score on the QSToolkit leaderboard. Check your full feedback dashboard for the detailed breakdown.`)}
        ${ctaButton('View My Feedback Dashboard →', `${BRAND.url}/feedback`)}
      `)}
    `
  });
  await send({ to: surveyor.email, subject: `New client rating: ${rating}/10 ⭐`, html });
};

// ════════════════════════════════════════════════════════════════
//  INVOICE TO CLIENT
// ════════════════════════════════════════════════════════════════
exports.sendInvoiceToClient = async (invoice, branding, pdfBuffer) => {
  const senderName = branding?.brand_name || 'QSToolkit User';
  const docType    = invoice.invoice_type === 'quotation' ? 'Quotation'
    : invoice.invoice_type === 'proforma' ? 'Proforma Invoice'
    : 'Invoice';
  const amount = `₦${Number(invoice.total_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const html = layout({
    preheader: `${docType} ${invoice.invoice_no} from ${senderName} — ${amount}`,
    body: `
      ${heroSection({
        emoji: '🧾',
        title: `${docType} from ${senderName}`,
        subtitle: `Ref: ${invoice.invoice_no}`
      })}
      ${bodySection(`
        ${bodyText(`Dear ${invoice.client_name},`)}
        ${bodyText(`Please find your ${docType.toLowerCase()} attached to this email. Here's a summary:`)}
        ${sectionTitle('Summary')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${infoRow('Document Number', invoice.invoice_no)}
          ${infoRow('Date Issued', invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')}
          ${invoice.due_date ? infoRow('Payment Due', new Date(invoice.due_date).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })) : ''}
          ${invoice.vat_percent ? infoRow(`VAT (${invoice.vat_percent}%)`, `₦${Number(invoice.vat_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`) : ''}
          ${infoRow('<strong>Total Amount</strong>', `<strong style="color:${BRAND.primary};font-size:16px;">${amount}</strong>`)}
        </table>
        ${bodyText(`The full ${docType.toLowerCase()} is attached to this email as a PDF.`, 'margin-top:20px;')}
        ${invoice.terms ? noteBox(`<strong>Payment Terms:</strong> ${invoice.terms}`, 'info') : ''}
        <p style="margin:28px 0 0;color:${BRAND.muted};font-size:12px;">Sent via QSToolkit · ${BRAND.url}</p>
      `)}
    `
  });

  const attachments = pdfBuffer ? [{
    content: Buffer.from(pdfBuffer).toString('base64'),
    name:    `${invoice.invoice_no}.pdf`
  }] : [];

  await send({
    to:          invoice.client_email,
    subject:     `${docType} ${invoice.invoice_no} from ${senderName} — ${amount}`,
    html,
    attachments
  });
};

// ════════════════════════════════════════════════════════════════
//  TEAM INVITATION
// ════════════════════════════════════════════════════════════════
exports.sendInvite = async (email, inviteUrl, role, orgName = '') => {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'manager' ? 'Manager' : 'Team Member';

  const html = layout({
    preheader: `You've been invited to join ${orgName || 'a team'} on QSToolkit`,
    body: `
      ${heroSection({ emoji: '📩', title: 'You have a team invitation', subtitle: orgName || 'QSToolkit Organisation' })}
      ${bodySection(`
        ${bodyText(`You've been invited to join <strong>${orgName || 'an organisation'}</strong> on QSToolkit as a <strong>${roleLabel}</strong>.`)}
        ${sectionTitle('Your Role')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${infoRow('Role', roleLabel)}
          ${infoRow('Organisation', orgName || '—')}
        </table>
        ${bodyText(`Click the button below to accept this invitation and join the team. The invitation expires in 7 days.`, 'margin-top:20px;')}
        ${ctaButton('Accept Invitation →', inviteUrl)}
        ${noteBox(`If you don't have a QSToolkit account yet, you'll be asked to create one first. Use this same email address when registering.`, 'info')}
        ${noteBox(`If you weren't expecting this invitation, simply ignore this email. No action needed.`, 'warning')}
      `)}
    `
  });

  await send({
    to:      email,
    subject: `You're invited to join ${orgName || 'a team'} on QSToolkit`,
    html
  });
};

// ════════════════════════════════════════════════════════════════
//  SUBSCRIPTION EXPIRY REMINDER
// ════════════════════════════════════════════════════════════════
exports.sendExpiryReminder = async ({ email, name, planName, expiresAt, renewUrl }) => {
  const firstName = name?.split(' ')[0] || 'there';
  const expiry    = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'soon';

  const html = layout({
    preheader: `Your QSToolkit ${planName} plan expires in 3 days`,
    body: `
      ${heroSection({ emoji: '⏰', title: 'Your subscription is expiring soon', subtitle: `Renew to avoid interruption` })}
      ${bodySection(`
        ${bodyText(`Hi ${firstName}, this is a friendly reminder that your <strong>${planName}</strong> subscription expires on <strong>${expiry}</strong>.`)}
        ${bodyText(`After that date, you'll lose access to your plan's features until you renew.`)}
        ${noteBox(`Your projects, BOQs, and saved calculations are <strong>never deleted</strong>. They'll be waiting for you when you come back.`, 'success')}
        ${ctaButton('Renew My Subscription →', renewUrl || `${BRAND.url}/subscription`)}
        ${bodyText(`If you've already renewed, please ignore this email.`, 'color:#94a3b8;font-size:13px;margin-top:20px;')}
      `)}
    `
  });

  await send({ to: email, subject: `Your QSToolkit ${planName} plan expires in 3 days`, html });
};

// ════════════════════════════════════════════════════════════════
//  PHILANTHROPIST — DONOR CONFIRMATION
// ════════════════════════════════════════════════════════════════
exports.sendPhilanthropistDonorConfirmation = async (meta) => {
  if (!meta?.donor_email) return;

  const html = layout({
    preheader: `Your gift subscription for ${meta.beneficiary_email} has been received`,
    body: `
      ${heroSection({ emoji: '🎁', title: 'Gift Subscription Confirmed!', subtitle: 'Your generosity is noted.' })}
      ${bodySection(`
        ${bodyText(`Hi ${meta.donor_name || 'there'}, thank you for gifting a QSToolkit subscription. Your payment was successful.`)}
        ${sectionTitle('Gift Details')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${infoRow('Recipient Email', meta.beneficiary_email)}
          ${infoRow('Plan', `${meta.plan_name} · ${meta.billing_cycle || 'Monthly'}`)}
        </table>
        ${noteBox(`The recipient hasn't registered on QSToolkit yet. The subscription will activate automatically as soon as they create an account using <strong>${meta.beneficiary_email}</strong>.`, 'warning')}
        ${meta.message_to_beneficiary ? `
          <div style="background:${BRAND.light};border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your message</p>
            <p style="margin:0;color:${BRAND.text};font-size:14px;font-style:italic;">"${meta.message_to_beneficiary}"</p>
          </div>` : ''}
      `)}
    `
  });

  await send({
    to:      meta.donor_email,
    subject: `Your gift subscription for ${meta.beneficiary_email} is confirmed`,
    html
  });
};

// ════════════════════════════════════════════════════════════════
//  PHILANTHROPIST — BENEFICIARY NOTIFICATION
// ════════════════════════════════════════════════════════════════
exports.sendPhilanthropistGiftNotification = async (beneficiary, meta) => {
  const firstName   = beneficiary.name?.split(' ')[0] || 'there';
  const donorLabel  = meta.donor_name || 'Someone';

  const html = layout({
    preheader: `${donorLabel} just gifted you a QSToolkit ${meta.plan_name} subscription!`,
    body: `
      ${heroSection({ emoji: '🎁', title: 'You received a gift!', subtitle: `${donorLabel} paid for your QSToolkit subscription.` })}
      ${bodySection(`
        ${bodyText(`Hi ${firstName}, great news — <strong>${donorLabel}</strong> has gifted you a <strong>${meta.plan_name} (${meta.billing_cycle || 'Monthly'})</strong> subscription on QSToolkit. It's now active on your account.`)}
        ${meta.message_to_beneficiary ? `
          <div style="background:${BRAND.light};border-left:4px solid ${BRAND.gold};border-radius:0 8px 8px 0;padding:16px;margin:20px 0;">
            <p style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message from ${donorLabel}</p>
            <p style="margin:0;color:${BRAND.text};font-size:15px;line-height:1.7;font-style:italic;">"${meta.message_to_beneficiary}"</p>
          </div>` : ''}
        ${ctaButton('Go to My Dashboard →', `${BRAND.url}/dashboard`)}
      `)}
    `
  });

  await send({
    to:      beneficiary.email,
    subject: `🎁 ${donorLabel} gifted you a QSToolkit ${meta.plan_name} subscription!`,
    html
  });
};
