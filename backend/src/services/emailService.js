const axios = require('axios');
const logger = require('../utils/logger');

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

async function sendEmail({ to, subject, htmlContent, attachments = [] }) {
  try {
    await axios.post(BREVO_API, {
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'QSToolkit',
        email: process.env.BREVO_SENDER_EMAIL || 'noreply@qstoolkit.com'
      },
      to: Array.isArray(to) ? to : [{ email: to }],
      subject,
      htmlContent,
      attachment: attachments
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    logger.error('Email send error:', err.response?.data || err.message);
  }
}

// ─── Welcome Email ────────────────────────────────────────────
exports.sendWelcome = async (user) => {
  await sendEmail({
    to: user.email,
    subject: '🏗️ Welcome to QSToolkit — Your QS Hub is Ready!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #f9f9f9;">
        <div style="background: #1a3c5e; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">QSToolkit</h1>
          <p style="color: #94a3b8; margin: 8px 0 0;">Nigeria's Quantity Surveying Platform</p>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <h2 style="color: #1a3c5e;">Welcome, ${user.name}! 🎉</h2>
          <p style="color: #475569; line-height: 1.6;">
            Your QSToolkit account is all set. You now have access to professional quantity surveying tools built specifically for Nigeria.
          </p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <h3 style="color: #1a3c5e; margin-top: 0;">What you can do:</h3>
            <ul style="color: #475569; line-height: 2;">
              <li>🧮 Run QS Calculations (Concrete, Steel, Masonry & more)</li>
              <li>📋 Create Bills of Quantities</li>
              <li>📁 Track your Projects</li>
              <li>🏆 Appear on the Leaderboard</li>
            </ul>
          </div>
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="display: block; background: #f59e0b; color: white; text-align: center; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 24px;">
            Go to My Dashboard →
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
            QSToolkit · qstoolkit.com · Built for Nigerian Quantity Surveyors
          </p>
        </div>
      </div>
    `
  });
};

// ─── Subscription Confirmation ────────────────────────────────
exports.sendSubscriptionConfirmation = async (user) => {
  await sendEmail({
    to: user.email,
    subject: '✅ Subscription Activated — QSToolkit',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px;">
        <h2 style="color: #1a3c5e;">Subscription Confirmed! 🎊</h2>
        <p>Hello ${user.name}, your <strong>${user.subscription_plans?.name}</strong> plan is now active.</p>
        <p>You now have full access to all features included in your plan.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #1a3c5e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
          Go to Dashboard
        </a>
      </div>
    `
  });
};

// ─── Client Feedback Request ──────────────────────────────────
exports.sendFeedbackRequest = async (clientEmail, clientName, feedbackUrl, projectTitle, surveyor, message) => {
  await sendEmail({
    to: clientEmail,
    subject: `Rate ${surveyor.company_name || surveyor.name}'s Work — QSToolkit`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #f9f9f9;">
        <div style="background: #1a3c5e; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f59e0b; margin: 0;">Project Feedback Request</h2>
        </div>
        <div style="background: white; padding: 32px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
          <p>Dear ${clientName || 'Valued Client'},</p>
          <p>${surveyor.company_name || surveyor.name} has requested your feedback on the project: <strong>${projectTitle}</strong>.</p>
          ${message ? `<blockquote style="border-left: 4px solid #f59e0b; padding-left: 16px; color: #475569;">${message}</blockquote>` : ''}
          <p>Your feedback helps improve the quality of service for all clients in Nigeria. It only takes 2 minutes.</p>
          <a href="${feedbackUrl}" 
             style="display: block; background: #f59e0b; color: white; text-align: center; padding: 14px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 24px 0;">
            Leave Feedback (Scale: 1–10)
          </a>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Powered by QSToolkit · qstoolkit.com</p>
        </div>
      </div>
    `
  });
};

// ─── New Feedback Notification ────────────────────────────────
exports.notifyNewFeedback = async (surveyor, rating) => {
  await sendEmail({
    to: surveyor.email,
    subject: `⭐ New Client Feedback — ${rating}/10`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px;">
        <h2 style="color: #1a3c5e;">You have a new client rating!</h2>
        <p>Hello ${surveyor.name}, a client just rated your work <strong>${rating}/10</strong> on QSToolkit.</p>
        <p>Check your feedback dashboard to see the full review and how it affects your leaderboard position.</p>
        <a href="${process.env.FRONTEND_URL}/feedback" style="background: #1a3c5e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px;">
          View My Feedback
        </a>
      </div>
    `
  });
};

// ─── Invoice to Client ────────────────────────────────────────
exports.sendInvoiceToClient = async (invoice, branding, pdfBuffer) => {
  const senderName = branding?.brand_name || 'QSToolkit User';
  await sendEmail({
    to: invoice.client_email,
    subject: `${invoice.invoice_type === 'quotation' ? 'Quotation' : 'Invoice'} ${invoice.invoice_no} from ${senderName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px;">
        <h2 style="color: #1a3c5e;">Dear ${invoice.client_name},</h2>
        <p>Please find your ${invoice.invoice_type} <strong>${invoice.invoice_no}</strong> attached.</p>
        <p><strong>Amount:</strong> ₦${invoice.total_amount?.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
        ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toDateString()}</p>` : ''}
        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">Sent via QSToolkit · qstoolkit.com</p>
      </div>
    `,
    attachments: pdfBuffer ? [{
      content: pdfBuffer.toString('base64'),
      name: `${invoice.invoice_no}.pdf`
    }] : []
  });
};

// ─── Team Invitation ──────────────────────────────────────────
exports.sendInvite = async (email, inviteUrl, role) => {
  await sendEmail({
    to: email,
    subject: 'You\'ve been invited to join a team on QSToolkit',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px;">
        <h2 style="color: #1a3c5e;">Team Invitation 📩</h2>
        <p>You have been invited to join an organization on QSToolkit as a <strong>${role}</strong>.</p>
        <a href="${inviteUrl}" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 16px; font-weight: bold;">
          Accept Invitation
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">This invitation expires in 7 days. If you did not expect this, ignore this email.</p>
      </div>
    `
  });
};
