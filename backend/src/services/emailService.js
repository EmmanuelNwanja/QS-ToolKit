/**
 * QSToolkit Email Service
 * Brand-consistent transactional email delivery via Mailjet.
 * Includes HTML + plain-text multipart delivery to reduce spam risk.
 */

const Mailjet = require('node-mailjet');
const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger');

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET;
const MAILJET_SENDER_EMAIL = process.env.MAILJET_SENDER_EMAIL;
const MAILJET_SENDER_NAME = process.env.MAILJET_SENDER_NAME;
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase(); // smtp | relay | mailjet | auto
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME;
const EMAIL_RELAY_URL = process.env.EMAIL_RELAY_URL;
const EMAIL_RELAY_TOKEN = process.env.EMAIL_RELAY_TOKEN;
const SMTP_HOSTS = (process.env.SMTP_HOSTS || '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const SMTP_CONNECTION_TIMEOUT = Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000);
const SMTP_GREETING_TIMEOUT = Number(process.env.SMTP_GREETING_TIMEOUT || 15000);
const SMTP_SOCKET_TIMEOUT = Number(process.env.SMTP_SOCKET_TIMEOUT || 20000);
const BRAND = {
  primary:    '#1a3c5e',
  gold:       '#f59e0b',
  light:      '#f8fafc',
  text:       '#334155',
  muted:      '#64748b',
  border:     '#e2e8f0',
  name:       'QSToolkit',
  url:        'https://qs.solnuv.com',
  email:      'hello@qs.solnuv.com',
  tagline:    "Nigeria's Quantity Surveying Platform"
};

if (EMAIL_PROVIDER === 'mailjet' || EMAIL_PROVIDER === 'auto') {
  if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
    logger.warn('Mailjet credentials missing; SMTP will be used if configured');
  }
  if (!MAILJET_SENDER_EMAIL) {
    logger.warn('MAILJET_SENDER_EMAIL missing; using fallback sender for Mailjet.');
  }
}

const mailjetClient = MAILJET_API_KEY && MAILJET_API_SECRET
  ? Mailjet.apiConnect(MAILJET_API_KEY, MAILJET_API_SECRET)
  : null;

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
const relayConfigured = !!EMAIL_RELAY_URL;

if (EMAIL_PROVIDER === 'smtp' && !smtpConfigured) {
  logger.error('Email service misconfigured: EMAIL_PROVIDER=smtp but SMTP_* credentials are missing');
}

if (EMAIL_PROVIDER === 'relay' && !relayConfigured) {
  logger.error('Email service misconfigured: EMAIL_PROVIDER=relay but EMAIL_RELAY_URL is missing');
}

if (EMAIL_PROVIDER === 'mailjet' && !mailjetClient) {
  logger.error('Email service misconfigured: EMAIL_PROVIDER=mailjet but MAILJET_* credentials are missing');
}

if (EMAIL_PROVIDER === 'auto' && !mailjetClient && !smtpConfigured && !relayConfigured) {
  logger.error('Email service misconfigured: no Mailjet, Relay, or SMTP provider is configured');
}

// ── Core send function ────────────────────────────────────────
async function send({ to, subject, html, text, attachments = [] }) {
  const recipients = (Array.isArray(to) ? to : [to]).map((entry) => {
    if (typeof entry === 'string') return { email: entry };
    if (!entry?.email) return null;
    return {
      email: entry.email,
      ...(entry.name ? { name: entry.name } : {})
    };
  }).filter((entry) => entry && entry.email);

  if (!recipients.length) {
    logger.error({ message: 'Email send skipped: no valid recipients', subject, to });
    return false;
  }

  const htmlPart = sanitizeHtmlDocument(html);
  const textPart = normalizePlainText(text || htmlToText(htmlPart));

  const providers = EMAIL_PROVIDER === 'auto'
    ? ['relay', ...(mailjetClient ? ['mailjet'] : []), 'smtp']
    : [EMAIL_PROVIDER];

  for (const provider of providers) {
    if (provider === 'mailjet' && mailjetClient) {
      const ok = await sendViaMailjet({ recipients, subject, htmlPart, textPart, attachments });
      if (ok) return true;
    }

    if (provider === 'relay' && relayConfigured) {
      const ok = await sendViaRelay({ recipients, subject, htmlPart, textPart, attachments });
      if (ok) return true;
    }

    if (provider === 'smtp' && smtpConfigured) {
      const ok = await sendViaSmtp({ recipients, subject, htmlPart, textPart, attachments });
      if (ok) return true;
    }
  }

  logger.error({ message: 'Email delivery failed for all configured providers', subject, to, providers });
  return false;
}

async function sendViaMailjet({ recipients, subject, htmlPart, textPart, attachments }) {
  try {
    const mailjetRecipients = recipients.map((r) => ({
      Email: r.email,
      ...(r.name ? { Name: r.name } : {})
    }));

    const mailjetAttachments = attachments.map((attachment) => {
      if (!attachment?.content || !attachment?.name) return null;
      return {
        Filename: attachment.name,
        ContentType: attachment.contentType || 'application/octet-stream',
        Base64Content: attachment.content
      };
    }).filter(Boolean);

    await mailjetClient
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [{
          From: {
            Email: MAILJET_SENDER_EMAIL || SMTP_FROM_EMAIL || BRAND.email,
            Name: MAILJET_SENDER_NAME || SMTP_FROM_NAME || BRAND.name
          },
          To: mailjetRecipients,
          Subject: subject,
          TextPart: textPart,
          HTMLPart: htmlPart,
          ...(mailjetAttachments.length ? { Attachments: mailjetAttachments } : {})
        }]
      });

    return true;
  } catch (err) {
    logger.error({
      message: 'Mailjet email delivery failed',
      subject,
      status: err.statusCode || err.response?.status,
      provider_error: err.response?.body || err.response?.data || err.message
    });
    return false;
  }
}

async function sendViaSmtp({ recipients, subject, htmlPart, textPart, attachments }) {
  const endpoints = buildSmtpEndpoints();
  let lastError = null;

  try {
    const to = recipients.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(', ');
    const smtpAttachments = attachments.map((attachment) => {
      if (!attachment?.content || !attachment?.name) return null;
      return {
        filename: attachment.name,
        content: Buffer.from(attachment.content, 'base64'),
        contentType: attachment.contentType || 'application/octet-stream'
      };
    }).filter(Boolean);

    for (const endpoint of endpoints) {
      try {
        const transport = nodemailer.createTransport({
          host: endpoint.host,
          port: endpoint.port,
          secure: endpoint.secure,
          requireTLS: endpoint.port === 587,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
          connectionTimeout: SMTP_CONNECTION_TIMEOUT,
          greetingTimeout: SMTP_GREETING_TIMEOUT,
          socketTimeout: SMTP_SOCKET_TIMEOUT,
          tls: {
            servername: endpoint.host,
            minVersion: 'TLSv1.2'
          }
        });

        await transport.sendMail({
          from: `${SMTP_FROM_NAME || MAILJET_SENDER_NAME || BRAND.name} <${SMTP_FROM_EMAIL || MAILJET_SENDER_EMAIL || BRAND.email}>`,
          to,
          subject,
          text: textPart,
          html: htmlPart,
          ...(smtpAttachments.length ? { attachments: smtpAttachments } : {})
        });

        return true;
      } catch (err) {
        lastError = err;
        logger.warn({
          message: 'SMTP endpoint attempt failed',
          host: endpoint.host,
          port: endpoint.port,
          secure: endpoint.secure,
          provider_error: err.message
        });
      }
    }
  } catch (err) {
    lastError = err;
  }

  if (lastError) {
    logger.error({
      message: 'SMTP email delivery failed',
      subject,
      provider_error: lastError.message
    });
  }

  return false;
}

async function sendViaRelay({ recipients, subject, htmlPart, textPart, attachments }) {
  try {
    const payload = {
      from: {
        email: SMTP_FROM_EMAIL || MAILJET_SENDER_EMAIL || BRAND.email,
        name: SMTP_FROM_NAME || MAILJET_SENDER_NAME || BRAND.name
      },
      to: recipients,
      subject,
      html: htmlPart,
      text: textPart,
      attachments
    };

    await axios.post(EMAIL_RELAY_URL, payload, {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        ...(EMAIL_RELAY_TOKEN ? { Authorization: `Bearer ${EMAIL_RELAY_TOKEN}` } : {})
      }
    });

    return true;
  } catch (err) {
    logger.error({
      message: 'Relay email delivery failed',
      subject,
      status: err.response?.status,
      provider_error: err.response?.data || err.message
    });
    return false;
  }
}

function buildSmtpEndpoints() {
  const hosts = [...new Set([SMTP_HOST, ...SMTP_HOSTS].filter(Boolean))];
  const lowerHosts = hosts.map((h) => h.toLowerCase());

  // Zoho fallback host variants help when account is provisioned in another region.
  if (lowerHosts.includes('smtp.zoho.com') && !lowerHosts.includes('smtp.zoho.eu')) {
    hosts.push('smtp.zoho.eu');
  }
  if (lowerHosts.includes('smtp.zoho.eu') && !lowerHosts.includes('smtp.zoho.com')) {
    hosts.push('smtp.zoho.com');
  }

  const ports = [...new Set([SMTP_PORT, 465, 587].filter(Boolean))];
  const endpoints = [];
  for (const host of hosts) {
    for (const port of ports) {
      endpoints.push({
        host,
        port,
        // 465 = implicit TLS (SMTPS), 587 = STARTTLS (secure must be false)
        secure: port === 465
      });
    }
  }
  return endpoints;
}

function sanitizeHtmlDocument(html) {
  return String(html || '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function htmlToText(html) {
  const withLinks = String(html || '').replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, label) => {
    const textLabel = stripTags(label).trim() || href;
    return `${textLabel} (${href})`;
  });

  const withBreaks = withLinks
    .replace(/<(br|\/p|\/div|\/tr|\/table|\/h[1-6]|\/li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<(p|div|table|tr|h[1-6])\b[^>]*>/gi, '\n');

  return decodeHtmlEntities(stripTags(withBreaks));
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizePlainText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

  return send({
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
  return send({ to: user.email, subject: `Welcome to QSToolkit, ${firstName}!`, html });
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
  return send({ to: user.email, subject: `Your QSToolkit ${planName} plan is active`, html });
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
  return send({
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
  return send({ to: surveyor.email, subject: `New client rating: ${rating}/10 ⭐`, html });
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

  return send({
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

  return send({
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

  return send({ to: email, subject: `Your QSToolkit ${planName} plan expires in 3 days`, html });
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

  return send({
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

  return send({
    to:      beneficiary.email,
    subject: `🎁 ${donorLabel} gifted you a QSToolkit ${meta.plan_name} subscription!`,
    html
  });
};

// ════════════════════════════════════════════════════════════════
//  ADMIN TEST EMAIL (TRANSPORT VERIFICATION)
// ════════════════════════════════════════════════════════════════
exports.sendAdminTestEmail = async ({ to, adminName = 'Admin', subject, note }) => {
  const ts = new Date().toISOString();
  const provider = (process.env.EMAIL_PROVIDER || 'auto').toLowerCase();

  const html = layout({
    preheader: 'QSToolkit test email for provider verification',
    body: `
      ${heroSection({ emoji: '🧪', title: 'Email Delivery Test', subtitle: 'Provider connectivity check passed.' })}
      ${bodySection(`
        ${bodyText(`Hi ${adminName}, this is a successful test email from QSToolkit.`)}
        ${bodyText('If you received this message, outbound email delivery is currently working for your configured provider path.')}
        ${sectionTitle('Diagnostics')}
        <table cellpadding="0" cellspacing="0" width="100%">
          ${infoRow('Timestamp (UTC)', ts)}
          ${infoRow('Configured Provider', provider)}
          ${infoRow('Application', BRAND.name)}
        </table>
        ${note ? noteBox(`Admin note: ${note}`, 'info') : ''}
      `)}
    `
  });

  return send({
    to,
    subject: subject || `QSToolkit Email Test (${provider})`,
    html
  });
};
